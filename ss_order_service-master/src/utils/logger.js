import winston from 'winston';

// PII masking functions
const maskEmail = (email) => {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return '***@***.***';
  return `${local.substring(0, 2)}***@***.***`;
};

const maskPhone = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '***-***-****';
  return `***-***-${cleaned.slice(-4)}`;
};

const maskAddress = (address) => {
  if (!address) return address;
  const parts = address.split(/\s+/);
  if (parts.length <= 2) return '***';
  return `*** ${parts.slice(1).join(' ')}`;
};

// Create logger with JSON format
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'order-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.json()
    })
  ]
});

// Helper to mask PII in log data
export const maskPii = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  const masked = { ...data };
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.phone) masked.phone = maskPhone(masked.phone);
  if (masked.address) masked.address = maskAddress(masked.address);
  if (masked.customer_email) masked.customer_email = maskEmail(masked.customer_email);
  if (masked.customer_phone) masked.customer_phone = maskPhone(masked.customer_phone);
  if (masked.customer_address) masked.customer_address = maskAddress(masked.customer_address);
  return masked;
};

export default logger;

