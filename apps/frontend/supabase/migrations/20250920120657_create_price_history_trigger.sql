-- Auto-populate supplier_price_history when prices change
-- Migration: 20250920120654_create_price_history_trigger.sql

CREATE OR REPLACE FUNCTION log_supplier_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_price IS DISTINCT FROM NEW.current_price THEN
        UPDATE supplier_price_history
        SET effective_to = NOW()
        WHERE supplier_product_id = NEW.id
          AND effective_to IS NULL;
        
        INSERT INTO supplier_price_history (
            supplier_product_id,
            old_price,
            new_price,
            changed_at,
            effective_from,
            effective_to,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.current_price,
            NEW.current_price,
            NOW(),
            NOW(),
            NULL,
            'Price updated'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_price_change_trigger
AFTER UPDATE ON supplier_products
FOR EACH ROW
WHEN (OLD.current_price IS DISTINCT FROM NEW.current_price)
EXECUTE FUNCTION log_supplier_price_change();

COMMENT ON FUNCTION log_supplier_price_change IS 'Automatically logs price changes to supplier_price_history';
