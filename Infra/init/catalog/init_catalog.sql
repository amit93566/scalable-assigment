-- Create products table if it doesn't exist
CREATE TABLE IF NOT EXISTS products (
    product_id INTEGER PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Load initial data from CSV file
COPY products(product_id, sku, name, category, price, is_active)
FROM '/docker-entrypoint-initdb.d/eci_products.csv'
DELIMITER ',' CSV HEADER;

