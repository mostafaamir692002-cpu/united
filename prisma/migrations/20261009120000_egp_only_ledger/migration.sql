-- The general ledger stores amounts without an FX currency or conversion rate.
-- Apply EGP-only guards to all currency-bearing business documents. NOT VALID lets
-- deployment proceed when historical foreign-currency rows exist; PostgreSQL still
-- enforces the constraint on every new or updated row. Historical rows must be
-- reconciled explicitly before the constraints can be validated.
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_currencyCode_egp_check" CHECK ("currencyCode" = 'EGP') NOT VALID;
ALTER TABLE "Company" ADD CONSTRAINT "Company_baseCurrencyCode_egp_check" CHECK ("baseCurrencyCode" = 'EGP') NOT VALID;
