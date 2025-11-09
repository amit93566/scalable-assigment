import { Registry, Counter } from 'prom-client';

const register = new Registry();

// Register default metrics (CPU, memory, etc.)
register.setDefaultLabels({
  app: 'order-service'
});

// Business metric: orders_placed_total
export const ordersPlacedTotal = new Counter({
  name: 'orders_placed_total',
  help: 'Total number of orders placed',
  labelNames: ['status'], // status: 'confirmed', 'failed', 'cancelled'
  registers: [register]
});

// Expose metrics endpoint
export const metricsHandler = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export { register };