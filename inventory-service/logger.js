import winston from 'winston';

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

export const maskPii = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  const masked = { ...data };
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.phone) masked.phone = maskPhone(masked.phone);
  return masked;
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'inventory-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.json()
    })
  ]
});

export default logger;

