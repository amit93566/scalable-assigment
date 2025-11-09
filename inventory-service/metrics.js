import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();
register.setDefaultLabels({
  app: 'inventory-service'
});

// Business metric: inventory_reserve_latency_ms
export const inventoryReserveLatency = new Histogram({
  name: 'inventory_reserve_latency_ms',
  help: 'Inventory reservation latency in milliseconds',
  labelNames: ['warehouse', 'status'], // status: 'success', 'partial', 'failed'
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000], // ms buckets
  registers: [register]
});

// Business metric: stockouts_total
export const stockoutsTotal = new Counter({
  name: 'stockouts_total',
  help: 'Total number of stockout events',
  labelNames: ['sku', 'warehouse'],
  registers: [register]
});

// Expose metrics endpoint
export const metricsHandler = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export { register };

