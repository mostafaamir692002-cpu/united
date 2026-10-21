# UNITED ERP — Prisma Data Model Map

**Source:** `prisma/schema.prisma` · **Provider:** PostgreSQL (Supabase) · **Lines:** 2,437

---

## Schema-Level Notes

- **All PKs:** `String @id @default(cuid())` except where noted (`BigInt @id @default(autoincrement())`, `String @id` for composite).
- **Status fields:** Plain `String` (not enums). Comments document allowed values; CHECK constraints exist in migrations (see §Missing Constraints).
- **Timestamps:** Convention is `@default(now())` on `createdAt`; `@updatedAt` only on mutable entities.
- **Soft-delete pattern:** Active boolean flags, not hard deletes. Some records are truly append-only (audit logs, stock movements, login attempts, eta document events).
- **Versioning:** Nearly every updatable entity carries `version Int @default(1)` for optimistic concurrency.
- **Decimal precision:** Quantity/currency columns use `@db.Decimal(18, N)` consistently.
- **Dual FK path convention:** Many entities store both an ID ref *and* a display-name copy (e.g., `assignedToId` + `assignedToName`). See caveats in §Data Integrity Gaps.

---

## Models by Module

### 1. Identity & Access

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **User** | id, name, username, passwordHash, role(String), active, version, sessionEpoch, mustChangePassword, passwordChangedAt?, createdAt | → UserPermissionOverride[], Notification[] | @unique username; indexes: [role], [active] | active=true, version=1, sessionEpoch=1, mustChangePassword=false, createdAt=now() |
| **Permission** | id, key(@unique), group, label, description?, createdAt | → RolePermission[], UserPermissionOverride[] | @unique key; index: [group] | createdAt=now() |
| **RolePermission** | id, role, permissionId, createdAt | @relation(permission) → Permission ON DELETE CASCADE | @@unique([role, permissionId]); indexes: [role], [permissionId] | createdAt=now() |
| **UserPermissionOverride** | id, userId, permissionId, effect(g\|r), reason?, grantedById?, grantedBy(=userId), createdAt, updatedAt | @relation(user→User CASCADE), @relation(permission→Permission CASCADE) | @@unique([userId, permissionId]); indexes: [userId], [permissionId] | createdAt=now() |

### 2. Orders & Items

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Order** | id, orderNumber(@unique), externalId?(?@unique), customerId?, customerName, deliveryDate, deliveryTime?, notes?, status(new→dispatched), shortage, needsReview, vehicle?, driverName?, crateCount?, source(manual/system/n8n/hermes), version, createdAt, updatedAt | → OrderItem[], AuditLog[], StockIssueException[], tripStops[]. ← customerAccount(Customer ?ON RESTRICT), quotation(Quotation?), invoices(SalesInvoice[]). assignedToId? | indexes: [status], [deliveryDate], [customerAccountId] | status="new", shortage=false, needsReview=false, source="manual", version=1 |
| **OrderItem** | id, orderId, productId?, productName, unit(KG), requiredQuantity, preparedQuantity?, loadedQuantity?, preparationStatus(pending/done), loadingStatus(pending/done), notes?, version, createdAt, updatedAt | @relation(order→Order) — **no onDelete**. stockProduct? → StockProduct. price? → OrderItemPrice. deliveryLines[]. | indexes: [orderId], [stockProductId] | unit="KG", preparationStatus="pending", loadingStatus="pending", version=1 |
| **OrderItemPrice** | orderItemId(@PK), unitPrice, discountPct(0), taxCode, taxRate, currencyCode(EGP), source(list/manual/quotation), priceListId?, priceListItemId?, reason?, setById?, setBy, version, updatedAt | @relation(orderItem→OrderItem ON RESTRICT) | orderItemId is PK | discountPct=0, currencyCode="EGP", version=1 |

### 3. Supply Chain / Inventory

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **StockProduct** | id, name(@unique), nameAr?, sku?(?@unique), category?, unit(KG), active, stockTracked, shelfLifeDays?, removalStrategy(fefo/fifo), costingMethod(avco/fifo/standard), standardCost?, minStockQty?, reorderPointQty?, maxStockQty?, coldChain, version, createdAt, updatedAt | ↔ aliases(ProductAlias CASCADE), orderItems[], priceListItems[], quotationLines[], supplierPrices[], purchaseLines[], rfqLines[], intakes[], movements[], lots[], packagings[], reservations[], valuationLayers[]. salesTax(TaxRate). supplierBillLines?. | indexes: [active], [category] | unit="KG", active=true, stockTracked=true, removalStrategy="fefo", costingMethod="avco", coldChain=false, salesTaxCode="EXEMPT" |
| **ProductAlias** | id, productId, alias, normalized(@unique), kind(canonical/canonical_ar/manual), createdById?, createdBy, createdAt | @relation(product→StockProduct CASCADE) | @@unique([normalized]) across ALL products; indexes: [productId], [kind] | kind="manual" |
| **Supplier** | id, code(@unique), name(@unique), phone?, notes?, active, version, createdAt, updatedAt, type(other), taxRegistrationNo?(?@unique), commercialRegNo?, email?, city?, address?, paymentTermsDays(0), currencyCode(EGP), leadTimeDays? | ↔ intakes[], lots[], documents[], contacts[], prices[], purchaseOrders[], rfqInvites[]. currency(Currency). bills[], debitNotes[], payments[], refunds[] | index: [active] | type="other", active=true, currencyCode="EGP", paymentTermsDays=0 |
| **SupplierContact** | id, supplierId, name, role?, phone?, email?, isPrimary, active, version, createdAt, updatedAt | @relation(supplier→ON RESTRICT) | index: [supplierId] | isPrimary=false, active=true |
| **SupplierPrice** | id, supplierId, productId, uomCode, unitPrice, currencyCode(EGP), validFrom, validTo?, minQty?, leadTimeDays?, notes?, createdById?, createdBy, createdAt | @relation(supplier→ON RESTRICT), @relation(product→ON RESTRICT), @relation(uom→?) | @@unique([supplierId, productId, uomCode, validFrom]); index: [productId, validFrom] | currencyCode="EGP" |
| **StockIntake** | id, receiptNumber(@unique), idempotencyKey?(?@unique), receivedDate, supplierId, productId, receivedQty, crateCount?, wasteQty(0), gradeBQty(0), rejectedQty(0), goodQty(computed), enteredQty?, enteredUom?, unitCost?, warehouseId, locationId, lotId?(?@unique), notes?, purchaseOrderLineId?, rejectionReason?, status(posted/voided), recordedById?, recordedBy, version, createdAt, updatedAt | @relation(supplier→?), @relation(product→?), @relation(warehouse→?), @relation(location→?), lot?(StockLot? ON RESTRICT), movements[], purchaseOrderLine?(PO Line? ON RESTRICT), billLines[]. | @@unique(lotId); indexes: [receivedDate], [purchaseOrderLineId], [supplierId], [productId], [status] | wasteQty=0, gradeBQty=0, rejectedQty=0, status="posted", version=1 |
| **StockMovement** | id, seq(BigInt @unique @autoincrement()), productId, occurredAt(=now()), effectiveDate, kind(intake/intake_correction/intake_void/adjustment), quantity(signed), warehouseId, locationId, lotId?, intakeId?, documentId?, unitCost?, reason, actorId?, actorName, createdAt | @relation(product→?), intake?, warehouse→?, location→?, lot?(ON RESTRICT), document?(ON RESTRICT), valuation?(StockValuationLayer?). valuationPosting?. | @@unique(seq); indexes: [productId, occurredAt], [productId, locationId, lotId], [documentId], [effectiveDate], [intakeId], [kind], [lotId] | quantity=signed, occurredAt=now(), createdAt=now() |
| **StockLot** | id, productId, lotNumber(LOT-YYYYMMDD-####), receivedDate, expiryDate?, supplierId?, unitCost?, version, createdAt | @relation(product→?), supplier?(ON RESTRICT), intake?, movements[] | @@unique([productId, lotNumber]); index: [productId, expiryDate] | createdAt=now() |
| **StockReservation** | id, productId, warehouseId, quantity, sourceType(order/manual), sourceId, sourceLineId?, status(active/released/consumed), createdById?, createdBy, closedReason?, version, createdAt, closedAt? | @relation(product→?), warehouse→? | indexes: [productId, warehouseId, status], [sourceType, sourceId] | status="active", version=1 |
| **InventoryDocument** | id, number(TRF-/ADJ-/RET-YYYY-####), type, status(pending_approval/posted/rejected/reversed), warehouseId, businessDate, reason?, sourceType?, sourceId?, supplierId?, payload(json?), idempotencyKey?(?@unique), requestHash?, reversalOfId?(?@unique), createdById?, createdBy, version, createdAt, postedAt? | @relation(warehouse→?), supplier?(ON RESTRICT), reversalOf?(self-ON RESTRICT), reversedBy?(self), movements[], issueExceptions[] | @@unique(number), @@unique(idempotencyKey), @@unique(reversalOfId); indexes: [type, status], [sourceType, sourceId], [businessDate] | createdAt=now() |
| **ProductPackaging** | id, productId, uomCode, qtyInBaseUnit, barcode?(?@unique), active, version, createdAt, updatedAt | @relation(product→?), uom→? | @@unique([productId, uomCode]) | active=true |
| **StockIssueException** | id, orderId, orderItemId, documentId?, productId?, productName, unit, requestedQty, issuedQty, reason(unmapped/unit_mismatch/insufficient), status(open/resolved/voided), resolution?, resolvedById?, resolvedBy?, resolvedAt?, version, createdAt | @relation(order→ON RESTRICT), document?(InventoryDoc? ON RESTRICT) | indexes: [status, createdAt], [orderId] | status="open", version=1 |
| **StockValuationLayer** | id, movementId(@unique), productId, quantity, unitCost, value, remainingQty(0), costSource(purchase/average/standard/fifo/lot/unknown), createdAt | @relation(movement→?), product→? | @@unique(movementId); indexes: [productId, createdAt], [createdAt] | remainingQty=0 |
| **StockValuationPosting** | movementId(@PK), entryId?, createdAt | @relation(movement→ON RESTRICT), entry?(JournalEntry? ON RESTRICT) | PK=[movementId]; index: [entryId] | createdAt=now() |
| **StorageLocation** | id, warehouseId, parentId?(→self), code, name, nameAr?, type(cold_room/chiller/freezer/dry/receiving/staging/dispatch/quarantine/other), capacityKg?, tempMinC?, tempMaxC?, active, version, createdAt, updatedAt | @relation(warehouse→?), parent?(LocationTree←self), children(LocationTree→self), movements[], intakes[] | @@unique([warehouseId, code]); indexes: [parentId], [active] | active=true |
| **Warehouse** | id, branchId, code(@unique), name, nameAr?, address?, areaM2?, dailyCapacityKg?, active, version, createdAt, updatedAt | @relation(branch→?), locations→[], movements[], intakes[], documents[], reservations[], rfqs[], purchaseOrders[] | indexes: [branchId], [active] | active=true |
| **Branch** | id, companyId, code, name, nameAr?, address?, phone?, active, version, createdAt, updatedAt | @relation(company→?), warehouses→[] | @@unique([companyId, code]); index: [active] | active=true |
| **Company** | id, code(@unique), legalName, tradeName?, nameAr?, taxRegistrationNo?, commercialRegistration?, address?, phone?, email?, baseCurrencyCode, active, version, createdAt, updatedAt | @relation(baseCurrency→Currency), branches[], etaIssuerProfile? | index: [active] | active=true |
| **Currency** | code(@PK), name, nameAr?, symbol, decimalPlaces(2), active, version, createdAt, updatedAt | companies[], customers[], priceLists[], suppliers[] | PK=code | decimalPlaces=2, active=true |

### 4. Core Configuration

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **SystemSetting** | key(@PK), value(Json), version, updatedById?, updatedBy, createdAt, updatedAt | — | PK=[key] | version=1, createdAt=now() |
| **NumberSequenceCounter** | sequenceKey, period, lastValue, updatedAt | — | PK=[sequenceKey, period] | updatedAt=@updatedAt |
| **Notification** | id, recipientId, type(event.dotted), severity(info/warning/critical), title, body?, entityType?, entityId?, link?, dedupeKey?, readAt?, createdAt | @relation(recipient→User CASCADE) | @@unique([recipientId, dedupeKey]); index: [recipientId, readAt, createdAt] | severity="info", createdAt=now() |
| **Attachment** | id, entityType, entityId, category(contract/invoice/delivery_note/…/other), fileName, contentType, sizeBytes, sha256, storageProvider, storageKey(@unique), description?, uploadedById?, uploadedBy, createdAt, deletedAt?, deletedById?, deletedBy?, deleteReason? | — | index: [entityType, entityId], index: [sha256] | createdAt=now() |
| **ApprovalRequest** | id, number(APR-YYYY-####), type, entityType, entityId, title, summary?, amount?, payload(json?), status(pending/approved/rejected/cancelled), requiredLevels(1), approvedLevels(0), requestedById?, requestedBy, requestReason?, decidedAt?, closedReason?, version, createdAt, updatedAt | decisions[]. | indexes: [status, type], [entityType, entityId] | status="pending", requiredLevels=1, approvedLevels=0, version=1 |
| **ApprovalDecision** | id, requestId, level, decision(approve/reject), deciderId?, decider, deciderRole, comment?, createdAt | @relation(request→ApprovalRequest, no onDelete) | @@unique([requestId, level]) | createdAt=now() |

### 5. Sales

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Customer** | id, code(CUS-00001, @unique), name, nameAr?, type(other), taxRegistrationNo?(?@unique), commercialRegNo?, phone?, email?, city?, area?, address?, deliveryNotes?, paymentTermsDays(0), creditLimit?, creditHold(false), creditHoldReason?, currencyCode(EGP), externalRef?(?@unique), notes?, active, version, createdById?, createdBy, createdAt, updatedAt | currency→, priceList?(PRICELIST ON RESTRICT), aliases[], contacts[], orders[], quotations[], invoices[], creditNotes[], receipts[], refunds[], etaReceiverProfile? | index: [active, name] | type="other", active=true, currencyCode="EGP", paymentTermsDays=0, creditHold=false |
| **CustomerAlias** | id, customerId, alias, normalized(@unique), kind(canonical/canonical_ar/manual), createdById?, createdBy, createdAt | @relation(customer→ON RESTRICT) | @@unique(normalized) across ALL; index: [customerId] | createdAt=now() |
| **CustomerContact** | id, customerId, name, role?, phone?, email?, isPrimary, active, version, createdAt, updatedAt | @relation(customer→ON RESTRICT) | index: [customerId] | isPrimary=false, active=true |
| **TaxRate** | code(@PK), name, nameAr, rate(DECIMAL(5,2)), etaType?, etaSubtype?, active, createdAt | products[] | PK=code | active=true |
| **PriceList** | id, code(@unique), name, currencyCode(EGP), isDefault, active, version, createdById?, createdBy, createdAt, updatedAt | currency→, items[], customers[] | @unique(code); partial unique on isDefault for exactly-one-active-default | currencyCode="EGP", isDefault=false, active=true |
| **PriceListItem** | id, priceListId, productId, uomCode, unitPrice, validFrom, validTo?, createdById?, createdBy, createdAt | @relation(priceList→ON RESTRICT), @relation(product→ON RESTRICT), @relation(uom→?) | @@unique([priceListId, productId, uomCode, validFrom]); index: [productId, validFrom] | createdAt=now() |
| **Quotation** | id, number(QUO-YYYY-####, @unique), customerId, status(draft/sent/accepted/rejected/converted/cancelled), validUntil, deliveryDate?, currencyCode(EGP), notes?, decisionNote?, orderId?(?@unique), version, createdById?, createdBy, createdAt, updatedAt | customer→(ON RESTRICT), order?(ON RESTRICT), lines[]. | indexes: [customerId, status], [status, validUntil] | status="draft", currencyCode="EGP" |
| **QuotationLine** | id, quotationId, lineNo, productId, uomCode, quantity, unitPrice, discountPct(0), taxCode, taxRate, priceSource(list/manual), notes? | @relation(quotation→CASCADE), @relation(product→ON RESTRICT) | @@unique([quotationId, lineNo]) | discountPct=0 |
| **SalesInvoice** | id, number?(INV-YYYY-####, ?@unique), status(draft/issued/void), customerId, orderId?, issueDate?, dueDate?, currencyCode(EGP), buyerName?, buyerTaxId?, buyerAddress?, gross(0), discountTotal(0), net(0), taxTotal(0), total(0), notes?, voidReason?, version, createdById?, createdBy, createdAt, issuedById?, issuedBy?, issuedAt? | customer→(ON RESTRICT), order?(ON RESTRICT), lines[], creditNotes[], receiptAllocations[]. | indexes: [customerId, status], [status, issueDate] | status="draft", currencyCode="EGP", all amounts=0 |
| **SalesInvoiceLine** | id, invoiceId, lineNo, orderItemId?, productId?, description, uomCode, quantity, unitPrice, discountPct(0), taxCode, taxRate, gross, discount, net, tax, total | @relation(invoice→ON RESTRICT), creditLines[]. | @@unique([invoiceId, lineNo]) | discountPct=0 |
| **CreditNote** | id, number(CN-YYYY-####, @unique), idempotencyKey?(?@unique), requestHash?, invoiceId, customerId, issueDate, reason, returnDocumentId?, currencyCode(EGP), gross, discountTotal, net, taxTotal, total, createdById?, createdBy, createdAt | invoice→(ON RESTRICT), customer→(ON RESTRICT), lines[]. | @@unique(number), @@unique(idempotencyKey); indexes: [customerId], [invoiceId] | currencyCode="EGP" |
| **CreditNoteLine** | id, creditNoteId, invoiceLineId, quantity, gross, discount, net, tax, total | @relation(creditNote→ON RESTRICT), @relation(invoiceLine→ON RESTRICT) | index: [invoiceLineId] | — |
| **DeliveryLine** | id, stopId, orderItemId, shippedQty, deliveredQty, shortageQty(0), damagedQty(0), rejectedQty(0), reason? | @relation(stop→ON RESTRICT), @relation(orderItem→ON RESTRICT) | @@unique([stopId, orderItemId]) | shortageQty=damagedQty=rejectedQty=0 |

### 6. Purchasing & Payables

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Rfq** | id, number(RFQ-YYYY-####, @unique), status(draft/sent/awarded/cancelled), neededBy?, warehouseId, notes?, version, createdById?, createdBy, createdAt | warehouse→, lines[], suppliers[], orders[]. | @@unique(number); index: [status] | status="draft" |
| **RfqLine** | id, rfqId, lineNo, productId, uomCode, quantity, notes? | @relation(rfq→CASCADE), @relation(product→ON RESTRICT), quotes[]. | @@unique([rfqId, lineNo]) | — |
| **RfqSupplier** | id, rfqId, supplierId, status(invited/quoted/declined), quotedAt?, validUntil?, notes?, recordedBy, version | @relation(rfq→CASCADE), @relation(supplier→ON RESTRICT), lines[]. | @@unique([rfqId, supplierId]) | status="invited" |
| **SupplierQuoteLine** | id, rfqSupplierId, rfqLineId, unitPrice, quantity?, leadTimeDays?, awarded(false) | @relation(rfqSupplier→CASCADE), @relation(rfqLine→CASCADE) | @@unique([rfqSupplierId, rfqLineId]) | awarded=false |
| **PurchaseOrder** | id, number(PO-YYYY-####, @unique), status(draft/pending_approval/approved/sent/partially_received/received/closed/cancelled), supplierId, warehouseId, rfqId?, orderDate, expectedDate?, currencyCode(EGP), paymentTermsDays(0), net(0), taxTotal(0), total(0), notes?, cancelReason?, approvedById?, approvedBy?, approvedAt?, sentAt?, closedAt?, version, createdById?, createdBy, createdAt | supplier→(ON RESTRICT), warehouse→, rfq?(ON RESTRICT), lines[]. | indexes: [supplierId, status], [status, expectedDate] | status="draft", currencyCode="EGP", paymentTermsDays=0, all amounts=0 |
| **PurchaseOrderLine** | id, poId, lineNo, productId, uomCode, quantity, baseQuantity, unitPrice, discountPct(0), taxCode, taxRate, priceSource(supplier_price/quotation/manual), supplierPriceId?, quoteLineId?, notes? | @relation(po→ON RESTRICT), @relation(product→ON RESTRICT), supplierPrice?(ON RESTRICT), intakes[], billLines[]. | @@unique([poId, lineNo]); index: [productId] | discountPct=0 |
| **SupplierBill** | id, number(BILL-YYYY-####, @unique), status(draft/pending_approval/posted/cancelled), supplierId, supplierInvoiceNo, billDate, dueDate, currencyCode(EGP), gross(0), discountTotal(0), net(0), taxTotal(0), total(0), expectedNet(0), variance(0), matchStatus(matched/within_tolerance/variance/unpriced), notes?, cancelReason?, approvedById?, approvedBy?, approvedAt?, postedById?, postedBy?, postedAt?, version, createdById?, createdBy, createdAt | supplier→(ON RESTRICT), lines[], debitNotes[], paymentAllocations[]. | indexes: [supplierId, status], [status, dueDate] | status="draft", matchStatus="matched", all amounts=0 |
| **SupplierBillLine** | id, billId, lineNo, intakeId, poLineId?, productId, description, uomCode, receivedQty, quantity, unitPrice, expectedUnitPrice?, expectedNet?, discountPct(0), taxCode, taxRate, gross, discount, net, tax, total, released(false) | @relation(bill→ON RESTRICT), @relation(intake→ON RESTRICT), @relation(poLine→ON RESTRICT), @relation(product→ON RESTRICT), debitLines[]. | @@unique([billId, lineNo]); indexes: [intakeId], [poLineId] | discountPct=0, released=false |
| **DebitNote** | id, number(DN-YYYY-####, @unique), idempotencyKey?(?@unique), requestHash?, billId, supplierId, issueDate, reason, returnDocumentId?, currencyCode(EGP), gross, discountTotal, net, taxTotal, total, createdById?, createdBy, createdAt | bill→(ON RESTRICT), supplier→(ON RESTRICT), lines[]. | @@unique(number), @@unique(idempotencyKey); indexes: [supplierId], [billId] | currencyCode="EGP" |
| **DebitNoteLine** | id, debitNoteId, billLineId, quantity, gross, discount, net, tax, total | @relation(debitNote→ON RESTRICT), @relation(billLine→ON RESTRICT) | index: [billLineId] | — |

### 7. Fleet & Delivery

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Vehicle** | id, code(@unique), plate(@unique), type(van/truck/pickup/other), capacityKg?, refrigerated, active, version, createdAt | trips[]. | indexes: none beyond PK/@unique | type="truck", refrigerated=false, active=true |
| **Driver** | id, name, phone?, active, version, createdAt | trips[]. | PK only | active=true |
| **Trip** | id, number(TRP-YYYY-####, @unique), status(planned/loading/loaded/dispatched/in_transit/completed/cancelled), tripDate, vehicleId, driverId, notes?, cancelReason?, loadingStartedAt?, loadedAt?, dispatchedAt?, departedAt?, completedAt?, version, createdById?, createdBy, createdAt | vehicle→(ON RESTRICT), driver→(ON RESTRICT), stops[]. | index: [status, tripDate] | status="planned" |
| **TripStop** | id, tripId, orderId, sequence, active(true), status(pending/delivered/partial/failed), crateCount?, receiverName?, customerNotes?, failureReason?, deliveredAt?, recordedById?, recordedBy?, returnDocumentId? | trip→(ON RESTRICT), order→(ON RESTRICT), lines[]. | indexes: [tripId], [orderId] | active=true, status="pending" |
| **OperationalException** | id, type(shortage/damage/rejection/delivery_failure/loading_discrepancy), status(open/resolved), sourceType(order/trip_stop/trip), sourceId, orderId?, tripId?, orderItemId?, productName?, quantity?, description, ownerId?, ownerName?, resolution?, resolvedById?, resolvedBy?, resolvedAt?, version, createdById?, createdBy, createdAt | — | indexes: [status, type], [orderId], [tripId] | status="open", version=1 |

### 8. Accounting

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Account** | id, code(@unique), name, nameAr, type(asset/liability/equity/revenue/expense), parentId?(→self), postable(true), systemKey?(?@unique), active, version, createdAt | parent?(AccountTree←self), children(AccountTree→self), lines[], cashAccounts[]. | index: none beyond PK/@unique | postable=true, active=true |
| **AccountingPeriod** | id, code(YYYY-MM, @unique), startDate, endDate, status(open/closed), closedBy?, closedAt?, version | — | PK=code | status="open" |
| **JournalEntry** | id, number(JE-YYYY-####, @unique), date, description, sourceType, sourceId, requestHash?, reversalOfId?(?@unique), total, createdById?, createdBy, createdAt | reversalOf?(self-ON RESTRICT), reversedBy?(self), lines[], valuationPostings[]. | @@unique(number), @@unique(reversalOfId); indexes: [date], [sourceType, sourceId] | createdAt=now() |
| **JournalLine** | id, entryId, accountId, debit(0), credit(0), partyType?, partyId?, description?, reconciliationId? | @relation(entry→ON RESTRICT), @relation(account→ON RESTRICT), reconciliation?(BankRecon? ON RESTRICT) | indexes: [entryId], [accountId], [partyType, partyId] | debit=0, credit=0 |
| **CashAccount** | id, code(@unique), name, type(cash/bank), accountId, active, createdAt | account→(ON RESTRICT), receipts[], payments[], customerRefunds[], supplierRefunds[], reconciliations[]. | PK only | active=true |
| **CustomerReceipt** | id, number(RCT-YYYY-####, @unique), idempotencyKey?(?@unique), customerId, cashAccountId, date, amount, method(cash/bank_transfer/cheque/wallet/other), reference?, notes?, createdById?, createdBy, createdAt | customer→(ON RESTRICT), cashAccount→(ON RESTRICT), allocations[], reversal(CustomerReceiptReversal?). | indexes: [customerId] | createdAt=now() |
| **ReceiptAllocation** | id, receiptId, invoiceId?, openingBalanceId?, amount | @relation(receipt→ON RESTRICT), invoice?(SalesInvoice? ON RESTRICT), openingBalance?(PartyOB? ON RESTRICT) | indexes: [invoiceId], [openingBalanceId] | — |
| **SupplierPayment** | id, number(PAY-YYYY-####, @unique), idempotencyKey?(?@unique), supplierId, cashAccountId, date, amount, method, reference?, notes?, createdById?, createdBy, createdAt | supplier→(ON RESTRICT), cashAccount→(ON RESTRICT), allocations[], reversal(SupplierPaymentReversal?). | indexes: [supplierId] | createdAt=now() |
| **PaymentAllocation** | id, paymentId, billId?, openingBalanceId?, amount | @relation(payment→ON RESTRICT), bill?(SupplierBill? ON RESTRICT), openingBalance?(PartyOB? ON RESTRICT) | indexes: [billId], [openingBalanceId] | — |
| **BankReconciliation** | id, cashAccountId, statementDate, statementBalance, status(open/completed), completedBy?, completedAt?, createdBy, createdAt | cashAccount→(ON RESTRICT), lines[]. | index: [cashAccountId] | status="open" |
| **PartyOpeningBalance** | id, partyType(customer/supplier), partyId, idempotencyKey?(?@unique), requestHash?, date, amount, dueDate, reference?, createdById?, createdBy, createdAt | receiptAllocations[], paymentAllocations[]. | index: [partyType, partyId] | createdAt=now() |
| **CustomerReceiptReversal** | id, receiptId(@unique), date, reason, createdById?, createdBy, createdAt | receipt→(ON RESTRICT) | PK only, receiptId unique | createdAt=now() |
| **SupplierPaymentReversal** | id, paymentId(@unique), date, reason, createdById?, createdBy, createdAt | payment→(ON RESTRICT) | PK only, paymentId unique | createdAt=now() |
| **CustomerRefund** | id, number(RFD-YYYY-####, @unique), idempotencyKey?(?@unique), customerId, cashAccountId, date, amount, method, reference?, reason, createdById?, createdBy, createdAt | customer→(ON RESTRICT), cashAccount→(ON RESTRICT) | @@unique(number), @@unique(idempotencyKey); index: [customerId] | createdAt=now() |
| **SupplierRefund** | id, number(SRF-YYYY-####, @unique), idempotencyKey?(?@unique), supplierId, cashAccountId, date, amount, method, reference?, reason, createdById?, createdBy, createdAt | supplier→(ON RESTRICT), cashAccount→(ON RESTRICT) | @@unique(number), @@unique(idempotencyKey); index: [supplierId] | createdAt=now() |

### 9. HR & Expenses

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Department** | id, code(@unique), name, active, createdAt | employees[]. | PK only, code unique | active=true |
| **Employee** | id, code(EMP-####, @unique), name, departmentId?, jobTitle?, phone?, userId?(→User, ?@unique), hireDate?, active, version, createdAt | department?(ON RESTRICT), expenses[], transactions[]. | PK only, code unique, userId unique | active=true |
| **Expense** | id, number(EXP-YYYY-####, @unique), idempotencyKey?(?@unique), requestHash?, date, employeeId?, accountId, amount, description, paymentMode(cash/reimburse/advance), cashAccountId?, status(pending_approval/approved/rejected), decidedBy?, decidedAt?, createdById?, createdBy, createdAt, version | employee?(ON RESTRICT) | @@unique(number), @@unique(idempotencyKey); indexes: [status], [employeeId] | status="pending_approval" |
| **EmployeeTransaction** | id, employeeId, idempotencyKey?(?@unique), requestHash?, type(advance/reimbursement/advance_return), date, amount, cashAccountId, notes?, createdById?, createdBy, createdAt | @relation(employee→ON RESTRICT) | @@unique(idempotencyKey); index: [employeeId] | createdAt=now() |

### 10. Integrations & Security

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **Integration** | id, code(@unique, also order `source`), name, keyHash(@unique), keyPrefix, scopes(String[]), active, lastUsedAt?, createdBy, createdAt, revokedAt?, revokedBy? | logs[]. | indexes: none beyond PK/@unique | active=true |
| **IntegrationLog** | id, integrationId?, caller("legacy"/"unknown"/code), method, path, status(Int HTTP), externalId?, result?, error?, durationMs, createdAt | @relation(integration→ON RESTRICT) | indexes: [createdAt], [integrationId, createdAt] | createdAt=now() |
| **LoginAttempt** | id, username(lowered), success, ip?, createdAt | — | index: [username, createdAt] | createdAt=now() |

### 11. ETA E-Invoicing

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **EtaIssuerProfile** | id, companyId(@unique), etaBranchId?, activityCode?, country?, governate?, regionCity?, street?, buildingNumber?, postalCode?, floor?, room?, landmark?, additionalInformation?, version, updatedById?, updatedBy, updatedAt | company→(ON RESTRICT) | PK only, companyId unique | version=1 |
| **EtaReceiverProfile** | id, customerId(@unique), receiverType(B/P/F)?, receiverId?, full address fields..., version, updatedById?, updatedBy, updatedAt | customer→(ON RESTRICT) | PK only, customerId unique | version=1 |
| **EtaItemCode** | id, productId(@unique), itemType(GS1/EGS), itemCode, updatedById?, updatedBy, updatedAt | product→(ON RESTRICT) | PK only, productId unique | — |
| **EtaUnitType** | uomCode(@PK), etaUnitType, updatedById?, updatedBy, updatedAt | uom→(ON RESTRICT) | PK=uomCode | — |
| **EtaDocument** | id, sourceType(sales_invoice/credit_note/debit_note), sourceId, internalId, documentType(i/c/d), documentTypeVersion, status(pending/submitting/submitted/valid/invalid/rejected/failed/unknown/cancelled), submissionId?, uuid?(?@unique), longId?, hashKey?, payloadHash?, attempts(0), submittedAt?, acceptedAt?, rejectedAt?, cancelledAt?, lastError(json?), lastResponse(json?), version, createdAt, updatedAt | events[]. | @@unique([sourceType, sourceId]), @@unique(uuid); index: [status] | status="pending", attempts=0 |
| **EtaDocumentEvent** | id, etaDocumentId, action(claim/submit_ok/submit_rejected/...), fromStatus?, toStatus, detail(json?), actorId?, actorName, createdAt | @relation(etaDocument→ON RESTRICT) | index: [etaDocumentId, createdAt] | createdAt=now() |

### 12. Audit & Miscellaneous

| Model | Fields | Relations | Unique / Indexes | Defaults |
|-------|--------|-----------|------------------|----------|
| **AuditLog** | id, timestamp(@now), userId?, userName, role, action, entityType, entityId, fieldChanged?, oldValue?, newValue?, reason?, source(user/system/n8n/hermes), deviceId?, orderId? | order? | indexes: [entityType, entityId], [orderId], [timestamp] | timestamp=now() |
| **NumberSequenceCounter** | (see §Core Config above) | — | PK=[sequenceKey, period] | — |
| **Currency** | (see §Supply Chain above) | — | PK=code | — |

---

## Enum / String Status Values (by model)

| Model | Field | Allowed Values | Notes |
|-------|-------|---------------|-------|
| **Order** | status | `new`, `preparing`, `ready_for_loading`, `loading`, `loaded`, `dispatched` | Comment: "cancelled is terminal, never deleted" |
| **OrderItem** | preparationStatus | `pending`, `done` | |
| **OrderItem** | loadingStatus | `pending`, `done` | |
| **StockIntake** | status | `posted`, `voided` | |
| **StockMovement** | kind | `intake`, `intake_correction`, `intake_void`, `adjustment` | Append-only |
| **InventoryDocument** | status | `pending_approval`, `posted`, `rejected`, `reversed` | Never edited |
| **InventoryDocument** | type | `transfer`, `adjustment`, `scrap`, `customer_return`, `supplier_return`, `issue` | |
| **StockReservation** | status | `active`, `released`, `consumed` | |
| **StockIssueException** | status | `open`, `resolved`, `voided` | |
| **StockIssueException** | reason | `unmapped`, `unit_mismatch`, `insufficient` | |
| **StockValuationLayer** | costSource | `purchase`, `average`, `standard`, `fifo`, `lot`, `unknown` | |
| **Customer** | type | `hotel`, `restaurant`, `cafe`, `retail`, `wholesale`, `institution`, `other` | |
| **CustomerAlias** | kind | `canonical`, `canonical_ar`, `manual` | |
| **Quotation** | status | `draft`, `sent`, `accepted`, `rejected`, `converted`, `cancelled` | expired = derived |
| **QuotationLine** | priceSource | `list`, `manual` | |
| **SalesInvoice** | status | `draft`, `issued`, `void` | void = draft discarded |
| **Rfq** | status | `draft`, `sent`, `awarded`, `cancelled` | |
| **RfqSupplier** | status | `invited`, `quoted`, `declined` | |
| **PurchaseOrder** | status | `draft`, `pending_approval`, `approved`, `sent`, `partially_received`, `received`, `closed`, `cancelled` | |
| **SupplierBill** | status | `draft`, `pending_approval`, `posted`, `cancelled` | |
| **SupplierBill** | matchStatus | `matched`, `within_tolerance`, `variance`, `unpriced` | |
| **Trip** | status | `planned`, `loading`, `loaded`, `dispatched`, `in_transit`, `completed`, `cancelled` | |
| **TripStop** | status | `pending`, `delivered`, `partial`, `failed` | |
| **OperationalException** | status | `open`, `resolved` | |
| **OperationalException** | type | `shortage`, `damage`, `rejection`, `delivery_failure`, `loading_discrepancy` | |
| **Account** | type | `asset`, `liability`, `equity`, `revenue`, `expense` | |
| **AccountingPeriod** | status | `open`, `closed` | |
| **JournalEntry** | sourceType | `manual`, `sales_invoice`, `credit_note`, `supplier_bill`, `debit_note`, `customer_receipt`, `supplier_payment`, `stock_valuation`, `reversal` | |
| **EmployeeTransaction** | type | `advance`, `reimbursement`, `advance_return` | |
| **Expense** | paymentMode | `cash`, `reimburse`, `advance` | |
| **Expense** | status | `pending_approval`, `approved`, `rejected` | |
| **CustomerReceipt** | method | `cash`, `bank_transfer`, `cheque`, `wallet`, `other` | |
| **SupplierPayment** | method | same | |
| **CustomerRefund / SupplierRefund** | method | same | |
| **BankReconciliation** | status | `open`, `completed` | |
| **DeliveryLine** | (no status; quantities carry outcome) | shippedQty = deliveredQty + shortageQty + damagedQty + rejectedQty (enforced by code/DB) | |
| **EtaDocument** | status | `pending`, `submitting`, `submitted`, `valid`, `invalid`, `rejected`, `failed`, `unknown`, `cancelled` | |
| **EtaDocumentEvent** | action | `claim`, `submit_ok`, `submit_rejected`, `submit_failed`, `submit_unknown`, `refresh`, `reconcile` | |
| **User** | role | `SUPER_ADMIN`, `SUPERVISOR`, `STOCK_CONTROLLER`, `PREPARER`, `LOADER`, `SALES`, `ACCOUNTANT` | Comment: plain strings, validated in services + migration CHECK |
| **Order** | source | `manual`, `system`, `n8n`, `hermes` | |
| **Attachment** | category | `contract`, `invoice`, `delivery_note`, `purchase_document`, `quality_photo`, `receipt`, `tax_document`, `other` | |
| **StorageLocation** | type | `cold_room`, `chiller`, `freezer`, `dry`, `receiving`, `staging`, `dispatch`, `quarantine`, `other` | |
| **UnitOfMeasure** | category | `weight`, `volume`, `count`, `package` | |
| **Vehicle** | type | `van`, `truck`, `pickup`, `other` | |
| **AuditLog** | source | `user`, `system`, `n8n`, `hermes` | |

---

## Relation Summary (FK Directions & Delete Rules)

| Relation (from → to) | Cascade / Restrict / No Action |
|---------------------|-------------------------------|
| RolePermission.role → ??? (role is plain String) | No FK defined |
| RolePermission.permissionId → Permission.id | **Cascade** |
| UserPermissionOverride.userId → User.id | **Cascade** |
| UserPermissionOverride.permissionId → Permission.id | **Cascade** |
| Order.customerAccount → Customer.id | **Restrict** |
| OrderItem.order → Order.id | **NO onDelete** ⚠️ |
| OrderItem.stockProduct → StockProduct.id | **NO onDelete** ⚠️ |
| OrderItemPrice.orderItem → OrderItem.id | **Restrict** |
| SupplierBill.supplier → Supplier.id | **Restrict** |
| SupplierBillLine.bill → SupplierBill.id | **Restrict** |
| SupplierBillLine.intake → StockIntake.id | **Restrict** |
| SupplierBillLine.poLine → PurchaseOrderLine.id | **Restrict** |
| SupplierBillLine.product → StockProduct.id | **Restrict** |
| DebitNote.bill → SupplierBill.id | **Restrict** |
| DebitNote.supplier → Supplier.id | **Restrict** |
| DebitNoteLine.debitNote → DebitNote.id | **Restrict** |
| DebitNoteLine.billLine → SupplierBillLine.id | **Restrict** |
| ProductAlias.product → StockProduct.id | **Cascade** |
| StockLot.supplier → Supplier.id | **Restrict** |
| StockLot.product → StockProduct.id | **NO onDelete** ⚠️ |
| StockIntake.lot → StockLot.id | **Restrict** |
| StockIntake.purchaseOrderLine → PurchaseOrderLine.id | **Restrict** |
| StockMovement.lot → StockLot.id | **Restrict** |
| StockMovement.document → InventoryDocument.id | **Restrict** |
| Quotation.customer → Customer.id | **Restrict** |
| Quotation.order → Order.id | **Restrict** |
| QuotationLine.quotation → Quotation.id | **Cascade** |
| QuotationLine.product → StockProduct.id | **Restrict** |
| SalesInvoice.customer → Customer.id | **Restrict** |
| SalesInvoice.order → Order.id | **Restrict** |
| SalesInvoiceLine.invoice → SalesInvoice.id | **Restrict** |
| CreditNote.invoice → SalesInvoice.id | **Restrict** |
| CreditNote.customer → Customer.id | **Restrict** |
| CreditNoteLine.creditNote → CreditNote.id | **Restrict** |
| CreditNoteLine.invoiceLine → SalesInvoiceLine.id | **Restrict** |
| CustomerReceipt.customer → Customer.id | **Restrict** |
| CustomerReceipt.cashAccount → CashAccount.id | **Restrict** |
| ReceiptAllocation.receipt → CustomerReceipt.id | **Restrict** |
| ReceiptAllocation.invoice → SalesInvoice.id | **Restrict** |
| ReceiptAllocation.openingBalance → PartyOpeningBalance.id | **Restrict** |
| SupplierPayment.supplier → Supplier.id | **Restrict** |
| SupplierPayment.cashAccount → CashAccount.id | **Restrict** |
| PaymentAllocation.payment → SupplierPayment.id | **Restrict** |
| PaymentAllocation.bill → SupplierBill.id | **Restrict** |
| PaymentAllocation.openingBalance → PartyOpeningBalance.id | **Restrict** |
| BankReconciliation.cashAccount → CashAccount.id | **Restrict** |
| JournalLine.entry → JournalEntry.id | **Restrict** |
| JournalLine.account → Account.id | **Restrict** |
| JournalLine.reconciliation → BankReconciliation.id | **Restrict** |
| CashAccount.account → Account.id | **Restrict** |
| CustomerReceiptReversal.receipt → CustomerReceipt.id | **Restrict** |
| SupplierPaymentReversal.payment → SupplierPayment.id | **Restrict** |
| CustomerRefund.customer → Customer.id | **Restrict** |
| CustomerRefund.cashAccount → CashAccount.id | **Restrict** |
| SupplierRefund.supplier → Supplier.id | **Restrict** |
| SupplierRefund.cashAccount → CashAccount.id | **Restrict** |
| Vehicle.trips → Trip.vehicleId | **Restrict** |
| Driver.trips → Trip.driverId | **Restrict** |
| Trip.vehicle → Vehicle.id | **Restrict** |
| Trip.driver → Driver.id | **Restrict** |
| TripStop.trip → Trip.id | **Restrict** |
| TripStop.order → Order.id | **Restrict** |
| DeliveryLine.stop → TripStop.id | **Restrict** |
| DeliveryLine.orderItem → OrderItem.id | **Restrict** |
| Department.employees → Employee.departmentId | **Restrict** |
| Employee.department → Department.id | **Restrict** |
| Employee.expenses → Expense.employeeId | **Restrict** |
| Employee.transactions → EmployeeTransaction.employeeId | **Restrict** |
| Expense.employee → Employee.id | **Restrict** |
| EmployeeTransaction.employee → Employee.id | **Restrict** |
| Integration.logs → IntegrationLog.integrationId | **Restrict** |
| StockValuationPosting.movement → StockMovement.id | **Restrict** |
| StockValuationPosting.entry → JournalEntry.id | **Restrict** |
| EtaIssuerProfile.company → Company.id | **Restrict** |
| EtaReceiverProfile.customer → Customer.id | **Restrict** |
| EtaItemCode.product → StockProduct.id | **Restrict** |
| EtaUnitType.uom → UnitOfMeasure.code | **Restrict** |
| EtaDocument.events → EtaDocumentEvent.etaDocumentId | **Restrict** |

---

## Composite Primary Keys

| Model | Composite PK |
|-------|-------------|
| NumberSequenceCounter | [sequenceKey, period] |
| StockValuationPosting | [movementId] (single-col PK) |
| EtaUnitType | [uomCode] |

## Self-Referencing Relations

| Model | Self-relation | Description |
|-------|--------------|-------------|
| StorageLocation | LocationTree: parentId → id | Parent zone → child zones |
| Account | AccountTree: parentId → id | Chart-of-accounts hierarchy |
| InventoryDocument | Reversal: reversalOfId → id | Document → its reversal doc |
| JournalEntry | Reversal: reversalOfId → id | JE → its reversal JE |

---

## Missing Constraints & Recommendations

### A. No Cascade Deletes (Orphan Risk)

These relations intentionally omit `onDelete`, meaning deleting a parent leaves orphans (or fails):

1. **OrderItem.order → Order** — **No `onDelete`**. Deleting an Order will leave OrderItems orphaned. Recommend adding `onDelete: Cascade` or at minimum `onDelete: SetNull` + `onDelete: Restrict` depending on desired policy. If orders are soft-deleted (inactive flag exists elsewhere), this may be acceptable; otherwise it's a latent bug.
2. **OrderItem.stockProduct → StockProduct** — **No `onDelete`**. Similar orphan risk.
3. **StockMovement.product → StockProduct** — **No `onDelete`**. Movement is append-only ledger, but if a product is removed, movements referencing it become orphaned. Consider `Restrict` to prevent product deletion while in-use, or cascade if products are soft-deleted.
4. **StockMovement.intake → StockIntake** — **No `onDelete`**. Same concern.
5. **StockLot.product → StockProduct** — **No `onDelete`**.
6. **RfqLine.rfq → Rfq** — Uses `onDelete: Cascade` ✓. Good.
7. **SupplierQuoteLine.rfqSupplier → RfqSupplier** — Uses `onDelete: Cascade` ✓. Good.
8. **SupplierQuoteLine.rfqLine → RfqLine** — Uses `onDelete: Cascade` ✓. Good.

### B. Missing CHECK Constraints

The schema comments (line 17-19) state: *"Role/OrderStatus/ItemStatus are plain strings… backed by CHECK constraints in the migrations."* This means individual Prisma models don't encode enum domains — the constraints exist in raw SQL migrations, not in the schema file itself.

If CHECK constraints are absent from migrations, this is the most impactful gap:
- **Order.status** — no DB-enforced transition validity (any string accepted)
- **User.role** — any string accepted
- All other status fields listed in §Enum/String Status Values above
- **StockMovement.quantity** — no non-negative enforcement on adjustments (though negative is intentional for contra entries, the mixed-positive-negative model should be validated)

**Recommendation:** Add inline `@@check` constraints where possible (Prisma 5.17+ supports them) or ensure migration scripts include them:
```prisma
@@check(status IN ('new', 'preparing', 'ready_for_loading', 'loading', 'loaded', 'dispatched'))
```

### C. Missing Indexes (Performance)

The following high-query-frequency fields lack indexes:

| Model | Field | Likely Query Pattern |
|-------|-------|---------------------|
| Customer | name | Search/filter by customer name |
| Customer | creditHold | Credit control queries |
| Customer | type | Segmented reporting |
| Supplier | name | Supplier lookup/search |
| Supplier | type | Segmented reporting |
| StockProduct | category | Category browsing/reporting |
| StockProduct | name | Name search (already @unique, but no BTREE for prefix search) |
| SalesInvoice | number | Invoice lookup (partially covered by customerId+status) |
| PurchaseOrder | number | PO lookup |
| Vendor invoices/payments | dueDate | Aging reports |
| SupplierBill | dueDate | Covered by [status, dueDate] index ✓ |
| Order | customerName | Customer search (order list by name) |
| Order | externalId | Lookup by external system ID (@unique implies implicit index, which is fine) |
| OrderItem | preparationStatus | Preparer workload view |
| InventoryDocument | type | Document filtering |
| Employee | departmentId | Department listing |
| Employee | active | Active employee roster |
| Vehicle | active | Available fleet |
| Driver | active | Available drivers |
| AuditLog | userId | User audit trail |
| JournalEntry | sourceType | Source-type filtering |

### D. Duplicate Data / Referential Integrity

Multiple models store both an ID reference and a human-readable name copy:

| Model | ID Field | Copy Field | Risk |
|-------|----------|------------|------|
| User | username | name | Low (name can legitimately change) |
| Order | customerId? (via customerAccount) | customerName | High — name drifts if customer record changes |
| Order | assignedToId | assignedToName | Medium — diverges if user renames |
| OrderItem | productId? | productName | High — free-text can differ from canonical |
| StockMovement | actorId? | actorName | Low — historical snapshot |
| AuditLog | userId? | userName | Low — audit preserves point-in-time |
| SupplierContact | supplierId | (none — OK) | — |
| Trips/Stops | Various | Various | See below |

**Recommendation:** Consider application-level validation or DB views to ensure copies stay consistent, especially for `Order.customerName` vs `Customer.name`.

### E. Business Rule Enforcement Gaps (Not Prisma-manageable, but notable)

1. **DeliveryLine invariant**: `shippedQty = deliveredQty + shortageQty + damagedQty + rejectedQty` — not enforced at DB level.
2. **StockMovement signed quantity**: Positive adds, negative removes — no trigger enforces that contra-movements balance the original.
3. **GoodQty computation**: StockIntake.goodQty = receivedQty - wasteQty - gradeBQty - rejectedQty — marked as "computed server-side" in comment, no DB DEFAULT or GENERATED column.
4. **StockReservation reduces available stock**: Not tracked in-schema (available = on-hand - reservations is computed at query time, not enforced).
5. **Parent cannot deactivate while children active**: Comment says so (§Core org data), but no FK with cascade/restrict prevents deactivating a Branch with active Warehouses.

### F. Small Observations

- **RolePermission.role is a plain String** — No FK to a Role model. Roles are defined in code (lib/authz.ts). The table works as a join but can't enforce that referenced roles actually exist.
- **OrderItemPrice.discountPct default** is 0 with DECIMAL(5,2) — caps at 99.99%. Fine.
- **Integration.scopes is `String[]`** — Prisma maps PostgreSQL text arrays to JavaScript arrays. Verify the migration creates a `TEXT[]` column.
- **NumberSequenceCounter.lastValue is plain `Int`** — no `BigInt`. With autoincrement, sequence counters shouldn't overflow INT (2B), but worth monitoring.
- **EtaDocumentEvent.toStatus is required** (nullable:false) but `fromStatus` is optional — makes sense for append-only event log.

---

## Entity Count Summary

| Module | Model Count |
|--------|-------------|
| Identity & Access | 4 (User, Permission, RolePermission, UserPermissionOverride) |
| Orders & Items | 3 (Order, OrderItem, OrderItemPrice) |
| Supply Chain / Inventory | 20 (StockProduct, ProductAlias, Supplier, SupplierContact, SupplierPrice, StockIntake, StockMovement, StockLot, StockReservation, InventoryDocument, ProductPackaging, StockIssueException, StockValuationLayer, StockValuationPosting, StorageLocation, Warehouse, Branch, Company, Currency, NumberSequenceCounter) |
| Core Config | 4 (SystemSetting, NumberSequenceCounter, Notification, Attachment, ApprovalRequest, ApprovalDecision) |
| Sales | 12 (Customer, CustomerAlias, CustomerContact, TaxRate, PriceList, PriceListItem, Quotation, QuotationLine, SalesInvoice, SalesInvoiceLine, CreditNote, CreditNoteLine, DeliveryLine) |
| Purchasing & Payables | 9 (Rfq, RfqLine, RfqSupplier, SupplierQuoteLine, PurchaseOrder, PurchaseOrderLine, SupplierBill, SupplierBillLine, DebitNote, DebitNoteLine) |
| Fleet & Delivery | 5 (Vehicle, Driver, Trip, TripStop, OperationalException) |
| Accounting | 15 (Account, AccountingPeriod, JournalEntry, JournalLine, CashAccount, CustomerReceipt, ReceiptAllocation, SupplierPayment, PaymentAllocation, BankReconciliation, PartyOpeningBalance, CustomerReceiptReversal, SupplierPaymentReversal, CustomerRefund, SupplierRefund) |
| HR & Expenses | 4 (Department, Employee, Expense, EmployeeTransaction) |
| Integrations & Security | 3 (Integration, IntegrationLog, LoginAttempt) |
| ETA E-Invoicing | 6 (EtaIssuerProfile, EtaReceiverProfile, EtaItemCode, EtaUnitType, EtaDocument, EtaDocumentEvent) |
| Audit & Misc | 1 (AuditLog) |
| **Total** | **~86 models** |

---

*End of Data Model Map.*
