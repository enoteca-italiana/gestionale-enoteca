import { useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { AdminArchiveToolbar } from '@/pages/admina/components/AdminArchiveToolbar';
import { AdminArchiveTable } from '@/pages/admina/components/AdminArchiveTable';
import { BulkEditFilteredModal } from '@/pages/admina/components/BulkEditFilteredModal';
import { CategoryCreateModal } from '@/pages/admina/components/CategoryCreateModal';
import { WineArchiveFormModal } from '@/pages/admina/components/WineArchiveFormModal';
import { useWineAdminPage } from '@/pages/admina/useWineAdminPage';

export function WineAdminPage() {
  const [totalsOpen, setTotalsOpen] = useState(false);
  const {
    loading,
    error,
    filters,
    setFilters,
    tableResetVersion,
    modalOpen,
    modalMode,
    formState,
    deleteId,
    setDeleteId,
    busy,
    bulkEditModalOpen,
    setBulkEditModalOpen,
    bulkEditBusy,
    categoryModalOpen,
    originModalOpen,
    producerModalOpen,
    allCategories,
    allOrigins,
    allProducers,
    filteredWines,
    archiveStats,
    canOpenBulkEdit,
    categories,
    producers,
    origins,
    handleRequestAddCategory,
    handleRequestAddOrigin,
    handleRequestAddProducer,
    confirmAddCategory,
    cancelAddCategory,
    confirmAddOrigin,
    cancelAddOrigin,
    confirmAddProducer,
    cancelAddProducer,
    openCreate,
    openEdit,
    closeForm,
    handleSubmit,
    handleDelete,
    handleQuickQtyUpdate,
    handleInlineFieldsUpdate,
    handleBulkEditConfirm,
    resetFilters
  } = useWineAdminPage();

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalWarehouse = 0;
    let totalPurchase = 0;
    let totalSale = 0;
    let totalMargin = 0;

    for (const wine of filteredWines) {
      const qty = Number.isFinite(wine.qty) ? Math.max(0, wine.qty) : 0;
      const purchase = Number.isFinite(wine.purchasePrice) ? (wine.purchasePrice as number) : 0;
      const sale = Number.isFinite(wine.salePrice) ? (wine.salePrice as number) : 0;
      const margin = sale - purchase;
      totalQty += qty;
      totalWarehouse += purchase * qty;
      totalPurchase += purchase;
      totalSale += sale;
      totalMargin += margin;
    }

    return {
      rows: filteredWines.length,
      qty: totalQty,
      warehouse: totalWarehouse,
      purchase: totalPurchase,
      sale: totalSale,
      margin: totalMargin
    };
  }, [filteredWines]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

  return (
    <div className="container archiveDesktopContainer">
      <div className="archiveLogoTop">
        <img
          className="archiveLogoImg"
          src="/logo.png"
          alt="Enoteca Italiana"
          loading="lazy"
          decoding="async"
          width={2252}
          height={237}
        />
      </div>

      <AdminArchiveToolbar
        winesCount={archiveStats.winesCount}
        thresholdCount={archiveStats.thresholdCount}
        outCount={archiveStats.outCount}
        filters={filters}
        categories={categories}
        producers={producers}
        origins={origins}
        onFiltersChange={setFilters}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        onResetFilters={resetFilters}
        onOpenCreate={openCreate}
        onOpenTotals={() => setTotalsOpen(true)}
      />

      {error ? (
        <div className="card adminCard mt12 adminError">
          <div className="lineTitle">{error}</div>
        </div>
      ) : null}

      <AdminArchiveTable
        wines={filteredWines}
        categories={allCategories}
        producers={allProducers}
        origins={allOrigins}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteId}
        onUpdateQty={handleQuickQtyUpdate}
        onUpdateInlineFields={handleInlineFieldsUpdate}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        resetVersion={tableResetVersion}
        bulkEditEnabled={canOpenBulkEdit}
        onOpenBulkEdit={() => setBulkEditModalOpen(true)}
      />

      <WineArchiveFormModal
        open={modalOpen}
        mode={modalMode}
        busy={busy}
        initial={formState}
        categories={allCategories}
        producers={allProducers}
        origins={allOrigins}
        onRequestAddCategory={handleRequestAddCategory}
        onRequestAddProducer={handleRequestAddProducer}
        onRequestAddOrigin={handleRequestAddOrigin}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />

      <BulkEditFilteredModal
        open={bulkEditModalOpen}
        busy={busy || bulkEditBusy}
        filteredCount={filteredWines.length}
        categories={allCategories}
        onConfirm={handleBulkEditConfirm}
        onCancel={() => {
          if (busy || bulkEditBusy) return;
          setBulkEditModalOpen(false);
        }}
      />

      <CategoryCreateModal
        open={categoryModalOpen}
        existingValues={allCategories}
        forceUppercase
        onCancel={cancelAddCategory}
        onConfirm={confirmAddCategory}
      />

      <CategoryCreateModal
        open={originModalOpen}
        existingValues={allOrigins}
        forceUppercase
        title="Nuova provenienza"
        inputPlaceholder="Inserisci provenienza"
        similarTitle="Provenienze già presenti simili"
        duplicateMessage="Provenienza già esistente: se confermi, verrà riusata quella esistente."
        ariaLabel="Nuova provenienza"
        onCancel={cancelAddOrigin}
        onConfirm={confirmAddOrigin}
      />

      <CategoryCreateModal
        open={producerModalOpen}
        existingValues={allProducers}
        title="Nuovo produttore"
        inputPlaceholder="Inserisci produttore"
        similarTitle="Produttori già presenti simili"
        duplicateMessage="Produttore già esistente: se confermi, verrà riusato quello esistente."
        ariaLabel="Nuovo produttore"
        onCancel={cancelAddProducer}
        onConfirm={confirmAddProducer}
      />

      <ConfirmModal
        open={deleteId !== null}
        title="Eliminare il vino?"
        description="L'operazione aggiorna Supabase e la sync di backup."
        confirmLabel={busy ? 'Elimino…' : 'Elimina'}
        cancelLabel="Annulla"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {totalsOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Totali archivio">
          <div className="modalCard archiveTotalsModalCard">
            <div className="modalTitle">Totali</div>
            <div className="archiveTotalsGrid mt12">
              <div className="archiveTotalsRow">
                <span>Righe filtrate</span>
                <strong>{totals.rows}</strong>
              </div>
              <div className="archiveTotalsRow">
                <span>Q.tà totale</span>
                <strong>{totals.qty}</strong>
              </div>
              <div className="archiveTotalsRow">
                <span>Acquisto</span>
                <strong>{formatCurrency(totals.purchase)}</strong>
              </div>
              <div className="archiveTotalsRow">
                <span>Vendita</span>
                <strong>{formatCurrency(totals.sale)}</strong>
              </div>
              <div className="archiveTotalsRow">
                <span>Margine</span>
                <strong>{formatCurrency(totals.margin)}</strong>
              </div>
              <div className="archiveTotalsRow">
                <span>Magazzino</span>
                <strong>{formatCurrency(totals.warehouse)}</strong>
              </div>
            </div>
            <div className="modalActions mt14">
              <button className="button" type="button" onClick={() => setTotalsOpen(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
