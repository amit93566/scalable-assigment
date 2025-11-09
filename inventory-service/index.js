import express from "express";
import mysql from "mysql2/promise";
import { inventoryReserveLatency, stockoutsTotal, metricsHandler } from './metrics.js';
import logger, { maskPii } from './logger.js';

const app = express();
app.use(express.json());

// CORS support for cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.body) {
    console.log(`[REQUEST_BODY]`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// MySQL connection pool
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'ipas',
  port: parseInt(process.env.DB_PORT || '3308'),
  waitForConnections: true,
  connectionLimit: 10,
};

// Log database configuration (without password)
console.log('[DB_CONFIG] MySQL Connection Configuration:');
console.log(`  Host: ${dbConfig.host}`);
console.log(`  Port: ${dbConfig.port}`);
console.log(`  User: ${dbConfig.user}`);
console.log(`  Database: ${dbConfig.database}`);
console.log(`  Password: ${dbConfig.password ? '***SET***' : 'NOT SET'}`);

const pool = mysql.createPool(dbConfig);

// Metrics endpoint for Prometheus
app.get('/actuator/prometheus', metricsHandler);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Test database connection
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    res.json({ status: "UP", service: "Inventory Service" });
  } catch (err) {
    console.error('[HEALTH_CHECK] Database connection failed:', {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      message: err.message,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    
    // Provide helpful error message
    let errorMessage = err.message;
    if (err.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to MySQL at ${dbConfig.host}:${dbConfig.port}. Is MySQL running?`;
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
      errorMessage = `Access denied for user '${dbConfig.user}'. Check DB_USER and DB_PASSWORD environment variables.`;
    } else if (err.code === 'ER_BAD_DB_ERROR' || err.errno === 1049) {
      errorMessage = `Database '${dbConfig.database}' does not exist. Check DB_NAME environment variable.`;
    }
    
    res.status(503).json({ 
      status: "DOWN", 
      error: errorMessage,
      dbConfig: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        database: dbConfig.database
      }
    });
  }
});

// Reservation TTL: 15 minutes
const RESERVATION_TTL_MINUTES = 15;

// Helper function to find warehouses for a product with available stock
async function findAvailableWarehouses(conn, product_id, qty) {
  const [rows] = await conn.query(
    `SELECT *, (on_hand - reserved) as available 
     FROM inventory 
     WHERE product_id = ? AND (on_hand - reserved) > 0
     ORDER BY (on_hand - reserved) DESC 
     FOR UPDATE`,
    [product_id]
  );
  return rows;
}

// Helper function to find single warehouse that can fulfill entire order
async function findSingleWarehouseForOrder(conn, items) {
  // Group items by product_id to find warehouses that have all products
  const productIds = [...new Set(items.map(item => item.product_id))];
  
  // Find warehouses that have all required products
  const warehouseMap = new Map();
  
  for (const productId of productIds) {
    const warehouses = await findAvailableWarehouses(conn, productId, 0);
    
    for (const wh of warehouses) {
      if (!warehouseMap.has(wh.warehouse)) {
        warehouseMap.set(wh.warehouse, new Map());
      }
      warehouseMap.get(wh.warehouse).set(productId, wh);
    }
  }
  
  // Find warehouse that has all products
  for (const [warehouse, productMap] of warehouseMap.entries()) {
    let canFulfill = true;
    for (const item of items) {
      const inv = productMap.get(item.product_id);
      if (!inv || (inv.on_hand - inv.reserved) < item.qty) {
        canFulfill = false;
        break;
      }
    }
    if (canFulfill) {
      return warehouse;
    }
  }
  
  return null;
}

// Helper function to allocate single warehouse (returns allocation strategy)
async function allocateWarehouseStrategy(conn, items) {
  // Try single-warehouse first
  const singleWarehouse = await findSingleWarehouseForOrder(conn, items);
  
  if (singleWarehouse) {
    return { strategy: 'SINGLE_WAREHOUSE', warehouse: singleWarehouse };
  }
  
  // Fallback to split allocation
  return { strategy: 'SPLIT' };
}

// Reserve stock for multiple items by SKU (with idempotency, single-warehouse-first, TTL, partial handling)
app.post("/v1/inventory/reserve", async (req, res) => {
  const startTime = Date.now();
  const { items, order_id } = req.body;
  // Check for idempotency key in headers (case-insensitive) or body
  const idempotencyKey = req.headers['idempotency-key'] || 
                         req.headers['Idempotency-Key'] || 
                         req.headers['IDEMPOTENCY-KEY'] ||
                         req.body.idempotency_key;
  
  // Validate request payload
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid request: 'items' array is required" });
  }
  if (!order_id) {
    return res.status(400).json({ error: "Invalid request: 'order_id' is required" });
  }
  // Idempotency key is now required
  if (!idempotencyKey) {
    return res.status(400).json({ 
      error: "Invalid request: 'idempotency-key' header is required",
      message: "Idempotency-Key header must be provided to ensure request uniqueness"
    });
  }

  logger.info('Reservation request received', maskPii({
    order_id,
    items_count: items.length,
    idempotency_key: idempotencyKey
  }));
  const conn = await pool.getConnection();
  let connReleased = false; // Track if connection has been released early
  let finalWarehouse = 'unknown';
  let reservationStatus = 'failed';

  try {
    await conn.beginTransaction();
    
    // 1️⃣ Check idempotency key (required - check for ANY existing reservations with same order_id and idempotency_key)
    // Check for any reservation regardless of status to prevent duplicate key errors
    const [existingReservations] = await conn.query(
      `SELECT * FROM reservations 
       WHERE idempotency_key = ? AND order_id = ?`,
      [idempotencyKey, order_id]
    );
    
    if (existingReservations.length > 0) {
      // Check if there are active reservations to return
      const activeReservations = existingReservations.filter(r => r.status === 'ACTIVE');
      
      if (activeReservations.length > 0) {
        // Return existing active reservations
        // Use the reservations directly since they already have all the data we need
        await conn.commit();
        console.log(`[RESERVE] Order ${order_id}: Idempotent request - returning ${activeReservations.length} existing active reservations`);
        return res.json({
          status: "RESERVED",
          order_id,
          idempotent: true,
          items: activeReservations.map(r => ({
            sku: r.sku,
            product_id: r.product_id,
            warehouse: r.warehouse,
            qty_reserved: r.quantity,
            reservation_id: r.reservation_id
          })),
          expires_at: activeReservations[0].expires_at
        });
      } else {
        // Reservations exist but are not active (CONFIRMED, EXPIRED, RELEASED)
        // This means the reservation was already processed - return error
        await conn.rollback();
        const statuses = [...new Set(existingReservations.map(r => r.status))];
        console.log(`[RESERVE] Order ${order_id}: Idempotency key already used with status(es): ${statuses.join(', ')}`);
        return res.status(409).json({
          error: "DUPLICATE_IDEMPOTENCY_KEY",
          message: `A reservation with this idempotency key already exists for this order with status: ${statuses.join(', ')}`,
          order_id,
          existing_statuses: statuses
        });
      }
    }

    // 2️⃣ Determine allocation strategy (single-warehouse-first)
    const allocation = await allocateWarehouseStrategy(conn, items);
    const strategy = allocation.strategy;
    const targetWarehouse = allocation.warehouse;
    
    const reservedItems = [];
    const partialItems = [];
    let hasPartial = false;
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    // 3️⃣ Reserve items based on strategy
    for (const item of items) {
      const { sku, product_id, qty } = item;

      if (!qty || qty <= 0) {
        throw new Error(`Invalid item: qty must be greater than 0`);
      }

      if (!product_id) {
        throw new Error(`Invalid item: product_id is required`);
      }

      let warehouses;
      if (strategy === 'SINGLE_WAREHOUSE' && targetWarehouse) {
        // Use single warehouse for all items
        const [whRows] = await conn.query(
          `SELECT * FROM inventory 
           WHERE product_id = ? AND warehouse = ? AND (on_hand - reserved) >= ?
           FOR UPDATE`,
          [product_id, targetWarehouse, qty]
        );
        warehouses = whRows;
      } else {
        // Split allocation - find best warehouse for this item
        warehouses = await findAvailableWarehouses(conn, product_id, qty);
      }

      if (warehouses.length === 0) {
        // No stock available - record stockout
        stockoutsTotal.inc({ 
          sku: sku || 'unknown', 
          warehouse: 'unknown' 
        });
        partialItems.push({
          sku: sku || null,
          product_id,
          qty_requested: qty,
          qty_available: 0,
          action_required: "BACKORDER_OR_REDUCE"
        });
        hasPartial = true;
        continue;
      }

      // Check if this specific product reservation already exists BEFORE reserving inventory
      // This prevents double-reservation and handles the unique constraint issue
      const [existingProductReservation] = await conn.query(
        `SELECT * FROM reservations 
         WHERE idempotency_key = ? AND order_id = ? AND product_id = ? AND status = 'ACTIVE'`,
        [idempotencyKey, order_id, product_id]
      );
      
      let reservationId;
      let warehouse;
      
      if (existingProductReservation.length > 0) {
        // This product was already reserved for this order with this idempotency key
        // Use the existing reservation - don't reserve inventory again
        reservationId = existingProductReservation[0].reservation_id;
        warehouse = existingProductReservation[0].warehouse;
        console.log(`[RESERVE] Order ${order_id}: Product ${product_id} already reserved, using existing reservation ${reservationId}`);
        
        // Add to reserved items without reserving inventory again
        reservedItems.push({
          sku: sku || null,
          product_id,
          warehouse,
          qty_reserved: existingProductReservation[0].quantity,
          qty_available: existingProductReservation[0].quantity,
          reservation_id: reservationId
        });
        
        console.log(`[RESERVE] Product ${product_id} (SKU: ${sku || 'N/A'}): Using existing reservation ${reservationId} from warehouse ${warehouse}`);
        reserved = true;
        continue; // Move to next item
      }
      
      // Try to reserve from first warehouse with sufficient stock
      let reserved = false;
      for (const inv of warehouses) {
        const available = inv.on_hand - inv.reserved;
        
        if (available >= qty) {
          // Atomic reserve: check and update in one operation
          const [updateResult] = await conn.query(
            `UPDATE inventory 
             SET reserved = reserved + ? 
             WHERE inventory_id = ? AND (on_hand - reserved) >= ?`,
            [qty, inv.inventory_id, qty]
          );

          if (updateResult.affectedRows === 0) {
            // Another transaction reserved it, try next warehouse
            continue;
          }

          warehouse = inv.warehouse;
          finalWarehouse = warehouse;
          
          // Create reservation record (idempotency_key is required and stored in all reservations)
          let reservationResult;
          try {
            const [result] = await conn.query(
              `INSERT INTO reservations 
               (order_id, product_id, sku, warehouse, quantity, idempotency_key, expires_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
              [order_id, product_id, sku || null, warehouse, qty, idempotencyKey, expiresAt]
            );
            reservationResult = result;
            reservationId = result.insertId;
          } catch (insertErr) {
              // Handle unique constraint violation (race condition - another request with same key completed)
              if (insertErr.code === 'ER_DUP_ENTRY' || insertErr.errno === 1062) {
                console.log(`[RESERVE] Order ${order_id}: Duplicate idempotency key detected during insert for product ${product_id} - checking all existing reservations`);
                
                // Check ALL reservations for this order (not just this product) to return complete response
                const [allReservations] = await conn.query(
                  `SELECT * FROM reservations 
                   WHERE idempotency_key = ? AND order_id = ?`,
                  [idempotencyKey, order_id]
                );
                
                console.log(`[RESERVE] Order ${order_id}: Found ${allReservations.length} existing reservations for this order`);
                
                if (allReservations.length > 0) {
                  // Rollback current transaction and return all existing reservations
                  await conn.rollback();
                  conn.release();
                  connReleased = true;
                  
                  const activeReservations = allReservations.filter(r => r.status === 'ACTIVE');
                  console.log(`[RESERVE] Order ${order_id}: Found ${activeReservations.length} active reservations out of ${allReservations.length} total`);
                  
                  if (activeReservations.length > 0) {
                    // Use reservations directly - they already have all the data we need
                    console.log(`[RESERVE] Order ${order_id}: Idempotent request (duplicate key) - returning ${activeReservations.length} existing reservations`);
                    return res.json({
                      status: "RESERVED",
                      order_id,
                      idempotent: true,
                      items: activeReservations.map(r => ({
                        sku: r.sku,
                        product_id: r.product_id,
                        warehouse: r.warehouse,
                        qty_reserved: r.quantity,
                        reservation_id: r.reservation_id
                      })),
                      expires_at: activeReservations[0].expires_at
                    });
                  } else {
                    const statuses = [...new Set(allReservations.map(r => r.status))];
                    return res.status(409).json({
                      error: "DUPLICATE_IDEMPOTENCY_KEY",
                      message: `A reservation with this idempotency key already exists for this order with status: ${statuses.join(', ')}`,
                      order_id,
                      existing_statuses: statuses
                    });
                  }
                } else {
                  // Unexpected duplicate entry error - no reservations found
                  throw new Error(`Failed to create reservation: duplicate idempotency key constraint violation for product ${product_id}, but no existing reservations found`);
                }
              } else {
                // Other database errors - rethrow to be handled by outer catch
                throw insertErr;
              }
          }

          // Log the movement
          await conn.query(
            `INSERT INTO inventory_Movements 
             (product_id, sku, warehouse, movement_type, quantity, reference_order_id, notes) 
             VALUES (?, ?, ?, 'RESERVE', ?, ?, ?)`,
            [product_id, sku || null, warehouse, qty, order_id, `Reserved for Order ${order_id} (SKU: ${sku || 'N/A'})`]
          );

          // Check for low stock alert (threshold: 10 units)
          const remainingAfter = available - qty;
          if (remainingAfter < 10) {
            console.warn(`[LOW_STOCK_ALERT] Product ${product_id} (SKU: ${sku || 'N/A'}) in ${warehouse}: Only ${remainingAfter} units remaining!`);
          }

          reservedItems.push({
            sku: sku || null,
            product_id,
            warehouse,
            qty_reserved: qty,
            qty_available: qty,
            reservation_id: reservationId
          });

          console.log(`[RESERVE] Product ${product_id} (SKU: ${sku || 'N/A'}): Reserved ${qty} units from warehouse ${warehouse}`);
          reserved = true;
          break;
        } else {
          // Partial stock available - record stockout
          stockoutsTotal.inc({ 
            sku: sku || 'unknown', 
            warehouse: inv.warehouse || 'unknown' 
          });
          partialItems.push({
            sku: sku || null,
            product_id,
            warehouse: inv.warehouse,
            qty_requested: qty,
            qty_available: available,
            action_required: "BACKORDER_OR_REDUCE"
          });
          hasPartial = true;
        }
      }

      if (!reserved && warehouses.length > 0) {
        // Had warehouses but couldn't reserve (partial or race condition)
        hasPartial = true;
      }
    }

    await conn.commit();
    
    const status = hasPartial ? "PARTIAL" : "RESERVED";
    reservationStatus = hasPartial ? 'partial' : 'success';
    const response = {
      status,
      order_id,
      allocation_strategy: strategy,
      items: reservedItems,
      expires_at: expiresAt.toISOString()
    };

    if (hasPartial && partialItems.length > 0) {
      response.items = [...reservedItems, ...partialItems];
    }

    // Record latency
    const latency = Date.now() - startTime;
    inventoryReserveLatency.observe({ 
      warehouse: finalWarehouse, 
      status: reservationStatus 
    }, latency);

    logger.info('Reservation completed', maskPii({
      order_id,
      status,
      latency_ms: latency,
      warehouse: finalWarehouse
    }));
    res.json(response);
  } catch (err) {
    if (!connReleased) {
      await conn.rollback();
    }
    
    // Record latency for failed requests
    const latency = Date.now() - startTime;
    inventoryReserveLatency.observe({ 
      warehouse: finalWarehouse, 
      status: 'failed' 
    }, latency);
    
    logger.error('Reservation failed', maskPii({
      order_id,
      error: err.message,
      latency_ms: latency
    }));
    
    // Handle unique constraint violation at transaction level
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      console.log(`[RESERVE] Order ${order_id}: Duplicate idempotency key detected - checking existing reservations`);
      
      // Try to get existing reservations (in a new connection since we rolled back)
      try {
        const checkConn = await pool.getConnection();
        const [existingReservations] = await checkConn.query(
          `SELECT * FROM reservations 
           WHERE idempotency_key = ? AND order_id = ?`,
          [idempotencyKey, order_id]
        );
        checkConn.release();
        
        if (existingReservations.length > 0) {
          const activeReservations = existingReservations.filter(r => r.status === 'ACTIVE');
          
          if (activeReservations.length > 0) {
            // Use reservations directly - they already have all the data we need
            console.log(`[RESERVE] Order ${order_id}: Idempotent request - returning ${activeReservations.length} existing reservations`);
            return res.json({
              status: "RESERVED",
              order_id,
              idempotent: true,
              items: activeReservations.map(r => ({
                sku: r.sku,
                product_id: r.product_id,
                warehouse: r.warehouse,
                qty_reserved: r.quantity,
                reservation_id: r.reservation_id
              })),
              expires_at: activeReservations[0].expires_at
            });
          } else {
            // Reservations exist but not active
            const statuses = [...new Set(existingReservations.map(r => r.status))];
            return res.status(409).json({
              error: "DUPLICATE_IDEMPOTENCY_KEY",
              message: `A reservation with this idempotency key already exists for this order with status: ${statuses.join(', ')}`,
              order_id,
              existing_statuses: statuses
            });
          }
        }
      } catch (checkErr) {
        console.error(`[RESERVE] Error checking existing reservations:`, checkErr.message);
      }
      
      return res.status(409).json({ 
        error: "DUPLICATE_IDEMPOTENCY_KEY", 
        message: "A reservation with this idempotency key already exists for this order",
        order_id 
      });
    }
    
    res.status(400).json({ error: err.message, order_id });
  } finally {
    if (!connReleased) {
      conn.release();
    }
  }
});

// Confirm reservations (called after payment success)
app.post("/v1/inventory/reserve/confirm", async (req, res) => {
  const { order_id, reservation_ids } = req.body;
  
  if (!order_id) {
    return res.status(400).json({ error: "Invalid request: 'order_id' is required" });
  }

  console.log(`[CONFIRM] Order ${order_id}: Confirming reservations`);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let query;
    let params;
    
    if (reservation_ids && Array.isArray(reservation_ids) && reservation_ids.length > 0) {
      // Confirm specific reservations
      const placeholders = reservation_ids.map(() => '?').join(',');
      query = `UPDATE reservations SET status = 'CONFIRMED' WHERE order_id = ? AND reservation_id IN (${placeholders}) AND status = 'ACTIVE'`;
      params = [order_id, ...reservation_ids];
    } else {
      // Confirm all active reservations for order
      query = `UPDATE reservations SET status = 'CONFIRMED' WHERE order_id = ? AND status = 'ACTIVE'`;
      params = [order_id];
    }

    const [result] = await conn.query(query, params);
    await conn.commit();

    console.log(`[CONFIRM] Order ${order_id}: Confirmed ${result.affectedRows} reservation(s)`);
    res.json({ 
      status: "CONFIRMED", 
      order_id,
      confirmed_reservations: result.affectedRows
    });
  } catch (err) {
    await conn.rollback();
    console.error(`[CONFIRM] Order ${order_id}: Error -`, err.message);
    res.status(400).json({ error: err.message, order_id });
  } finally {
    conn.release();
  }
});

// Release reserved stock (when payment fails or order canceled)
app.post("/v1/inventory/release", async (req, res) => {
  const { items, order_id } = req.body;
  
  // Validate request payload
  if (!order_id) {
    return res.status(400).json({ error: "Invalid request: 'order_id' is required" });
  }

  console.log(`[RELEASE] Order ${order_id}: Releasing reservations`);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Update reservation status to RELEASED
    const [reservationResult] = await conn.query(
      `UPDATE reservations SET status = 'RELEASED' WHERE order_id = ? AND status = 'ACTIVE'`,
      [order_id]
    );

    // Get reservations to release inventory
    const [reservations] = await conn.query(
      `SELECT * FROM reservations WHERE order_id = ? AND status = 'RELEASED'`,
      [order_id]
    );

    // Release inventory for each reservation
    for (const reservation of reservations) {
      await conn.query(
        "UPDATE inventory SET reserved = GREATEST(reserved - ?, 0) WHERE product_id=? AND warehouse=?",
        [reservation.quantity, reservation.product_id, reservation.warehouse]
      );

      await conn.query(
        `INSERT INTO inventory_Movements 
         (product_id, sku, warehouse, movement_type, quantity, reference_order_id, notes)
         VALUES (?, ?, ?, 'RELEASE', ?, ?, ?)`,
        [reservation.product_id, reservation.sku || null, reservation.warehouse, reservation.quantity, order_id, `Released for Order ${order_id} (SKU: ${reservation.sku || 'N/A'})`]
      );
      
      console.log(`[RELEASE] Product ${reservation.product_id} (SKU: ${reservation.sku || 'N/A'}): Released ${reservation.quantity} units from ${reservation.warehouse}`);
    }

    await conn.commit();
    console.log(`[RELEASE] Order ${order_id}: Successfully released ${reservationResult.affectedRows} reservation(s)`);
    res.json({ status: "RELEASED", order_id, released_count: reservationResult.affectedRows });
  } catch (err) {
    await conn.rollback();
    console.error(`[RELEASE] Order ${order_id}: Error -`, err.message);
    res.status(400).json({ error: err.message, order_id });
  } finally {
    conn.release();
  }
});

app.post("/v1/inventory/ship", async (req, res) => {
  const { items, order_id } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid request: 'items' array is required" });
  }
  if (!order_id) {
    return res.status(400).json({ error: "Invalid request: 'order_id' is required" });
  }

  console.log(`[SHIP] Order ${order_id}: Shipping ${items.length} item(s)`);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const item of items) {
      const { sku, product_id, qty, warehouse } = item;

      if (!product_id || !qty || !warehouse) {
        throw new Error(`Invalid item: product_id, qty, and warehouse are required`);
      }

      // 1️⃣ Deduct on_hand and reserved
      await conn.query(
        `UPDATE inventory
         SET on_hand = GREATEST(on_hand - ?, 0),
             reserved = GREATEST(reserved - ?, 0),
             updated_at = NOW()
         WHERE product_id=? AND warehouse=?`,
        [qty, qty, product_id, warehouse]
      );

      // 2️⃣ Log movement with SKU
      await conn.query(
        `INSERT INTO inventory_Movements 
         (product_id, sku, warehouse, movement_type, quantity, reference_order_id, notes)
         VALUES (?, ?, ?, 'SHIP', ?, ?, ?)`,
        [product_id, sku || null, warehouse, qty, order_id, `Shipped for Order ${order_id} (SKU: ${sku || 'N/A'})`]
      );
      
      console.log(`[SHIP] Product ${product_id} (SKU: ${sku || 'N/A'}): Shipped ${qty} units from ${warehouse}`);
    }

    await conn.commit();
    console.log(`[SHIP] Order ${order_id}: Successfully shipped all items`);
    res.json({ status: "SHIPPED", order_id });
  } catch (err) {
    await conn.rollback();
    console.error(`[SHIP] Order ${order_id}: Error -`, err.message);
    res.status(400).json({ error: err.message, order_id });
  } finally {
    conn.release();
  }
});

// Reaper job: Release expired reservations (should be called periodically, e.g., every 5 minutes)
app.post("/v1/inventory/reaper/expired", async (req, res) => {
  console.log(`[REAPER] Starting expired reservations cleanup`);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Find expired active reservations
    const [expiredReservations] = await conn.query(
      `SELECT * FROM reservations 
       WHERE status = 'ACTIVE' AND expires_at < NOW()`
    );

    if (expiredReservations.length === 0) {
      await conn.commit();
      return res.json({ 
        status: "PROCESSED", 
        expired_count: 0,
        released_reservations: []
      });
    }

    const reservationIds = expiredReservations.map(r => r.reservation_id);
    const placeholders = reservationIds.map(() => '?').join(',');

    // Update reservation status to EXPIRED
    await conn.query(
      `UPDATE reservations SET status = 'EXPIRED' WHERE reservation_id IN (${placeholders})`,
      reservationIds
    );

    // Release inventory for each expired reservation
    for (const reservation of expiredReservations) {
      await conn.query(
        `UPDATE inventory 
         SET reserved = GREATEST(reserved - ?, 0) 
         WHERE product_id = ? AND warehouse = ?`,
        [reservation.quantity, reservation.product_id, reservation.warehouse]
      );

      await conn.query(
        `INSERT INTO inventory_Movements 
         (product_id, sku, warehouse, movement_type, quantity, reference_order_id, notes)
         VALUES (?, ?, ?, 'RELEASE', ?, ?, ?)`,
        [
          reservation.product_id, 
          reservation.sku || null, 
          reservation.warehouse, 
          reservation.quantity, 
          reservation.order_id, 
          `Expired reservation auto-released for Order ${reservation.order_id} (SKU: ${reservation.sku || 'N/A'})`
        ]
      );
    }

    await conn.commit();

    console.log(`[REAPER] Released ${expiredReservations.length} expired reservation(s)`);
    res.json({ 
      status: "PROCESSED", 
      expired_count: expiredReservations.length,
      released_reservations: reservationIds
    });
  } catch (err) {
    await conn.rollback();
    console.error(`[REAPER] Error -`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Catch-all route for debugging unmatched requests
app.use((req, res, next) => {
  console.warn(`[UNMATCHED_ROUTE] ${req.method} ${req.path} - No handler found`);
  console.warn(`[UNMATCHED_ROUTE] Headers:`, JSON.stringify(req.headers, null, 2));
  console.warn(`[UNMATCHED_ROUTE] Query:`, JSON.stringify(req.query, null, 2));
  res.status(404).json({ 
    error: 'Not Found', 
    message: `No route found for ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /health',
      'POST /v1/inventory/reserve',
      'POST /v1/inventory/reserve/confirm',
      'POST /v1/inventory/release',
      'POST /v1/inventory/ship',
      'POST /v1/inventory/reaper/expired'
    ]
  });
});

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`✅ inventory Service running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /v1/inventory/reserve (with idempotency, single-warehouse-first, TTL)`);
  console.log(`   POST /v1/inventory/reserve/confirm`);
  console.log(`   POST /v1/inventory/release`);
  console.log(`   POST /v1/inventory/ship`);
  console.log(`   POST /v1/inventory/reaper/expired`);
  
  // Reaper job should be called periodically (e.g., via cron or external scheduler)
  // Call POST /v1/inventory/reaper/expired every 5 minutes
  console.log(`🔄 Reaper job: Call POST /v1/inventory/reaper/expired periodically (recommended: every 5 minutes)`);
});
