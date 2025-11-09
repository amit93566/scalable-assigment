-- init_inventory.sql
CREATE TABLE IF NOT EXISTS inventory (
 inventory_id INTEGER PRIMARY KEY,
 product_id INTEGER NOT NULL,
 warehouse VARCHAR(100) NOT NULL,
 on_hand INTEGER DEFAULT 0,
 reserved INTEGER DEFAULT 0,
 updated_at TIMESTAMP
);


-- Load CSV (server-side COPY so it runs during docker init)
COPY inventory(inventory_id, product_id, warehouse, on_hand, reserved, updated_at)
FROM '/docker-entrypoint-initdb.d/eci_inventory.csv'
DELIMITER ',' CSV HEADER;


CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    warehouse VARCHAR(100) NOT NULL,
    change_type VARCHAR(50) NOT NULL,  -- RESERVE, RELEASE, SHIP, RESTOCK
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50),        -- ORDER, SHIPMENT
    reference_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
);

