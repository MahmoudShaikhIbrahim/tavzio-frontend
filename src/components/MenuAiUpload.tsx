import { useState, type ChangeEvent } from 'react';
import {
  extractMenuAi, publishMenuAi,
  type MenuAiDraftCategory,
} from '../lib/authApi';
import { Section, PrimaryButton, ActionButton } from './ui';

const ACCEPT = '.pdf,.xlsx,.xls,.csv,image/*';

export default function MenuAiUpload({ businessId, onPublished }: { businessId: string; onPublished: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [hasResult, setHasResult] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unclear, setUnclear] = useState<{ imageIndex: number; reason: string }[]>([]);
  // Only the image-type files from the original upload, in order - this
  // is the SAME indexing the backend's imageIndex refers to (PDFs/Excel
  // don't consume a slot there), built once from the first extraction so
  // a retry always knows exactly which original photo it's replacing.
  const [imageSlots, setImageSlots] = useState<File[]>([]);
  const [retryingSlot, setRetryingSlot] = useState<number | null>(null);
  const [categories, setCategories] = useState<MenuAiDraftCategory[]>([]);
  const [publishSummary, setPublishSummary] = useState<{ categoriesCreated: number; itemsCreated: number } | null>(null);

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles(picked);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function runExtraction(fileList: File[]) {
    if (fileList.length === 0) return;
    setExtracting(true);
    setError('');
    try {
      const res = await extractMenuAi(businessId, fileList);
      setHasResult(true);
      setWarnings(res.warnings);
      setUnclear(res.unclear);
      setCategories(res.categories);
      setImageSlots(fileList.filter((f) => f.type.startsWith('image/')));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the menu from these files');
    } finally {
      setExtracting(false);
    }
  }

  // Merges a category into the existing draft by name (case-insensitive) -
  // appends to a matching category if one exists, otherwise adds it as a
  // new one. Used when a single-photo retry comes back clean and needs
  // to fold its items into the menu we already have, without disturbing
  // anything else already reviewed.
  function mergeCategory(incoming: MenuAiDraftCategory) {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.name.trim().toLowerCase() === incoming.name.trim().toLowerCase());
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = { ...next[idx], items: [...next[idx].items, ...incoming.items] };
      return next;
    });
  }

  // The actual fix: a flagged photo gets re-uploaded and re-read ALONE,
  // not as part of the original batch again - so fixing 2 bad photos out
  // of 10 costs roughly what reading 2 photos costs, not what reading 10
  // photos costs a second time. Successfully-read photos are never
  // re-sent to Claude at all.
  async function retryUnclearSlot(imageIndex: number, e: ChangeEvent<HTMLInputElement>) {
    const replacement = e.target.files?.[0];
    e.target.value = '';
    if (!replacement) return;

    const updatedSlots = [...imageSlots];
    updatedSlots[imageIndex] = replacement;
    setImageSlots(updatedSlots);
    setRetryingSlot(imageIndex);
    setError('');
    try {
      const res = await extractMenuAi(businessId, [replacement]);
      if (res.unclear.length > 0) {
        // Still unreadable - keep this exact slot flagged with the new
        // reason, rather than folding a wrong imageIndex (always 0 in a
        // solo call) back in confusingly.
        setUnclear((prev) => prev.map((u) => (u.imageIndex === imageIndex ? { imageIndex, reason: res.unclear[0].reason } : u)));
      } else {
        res.categories.forEach(mergeCategory);
        setUnclear((prev) => prev.filter((u) => u.imageIndex !== imageIndex));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the replacement photo');
    } finally {
      setRetryingSlot(null);
    }
  }

  function updateItem(ci: number, ii: number, patch: Partial<MenuAiDraftCategory['items'][number]>) {
    setCategories((prev) => {
      const next = [...prev];
      const items = [...next[ci].items];
      items[ii] = { ...items[ii], ...patch };
      next[ci] = { ...next[ci], items };
      return next;
    });
  }

  function removeItem(ci: number, ii: number) {
    setCategories((prev) => {
      const next = [...prev];
      next[ci] = { ...next[ci], items: next[ci].items.filter((_, i) => i !== ii) };
      return next;
    });
  }

  function updateCategoryName(ci: number, name: string) {
    setCategories((prev) => {
      const next = [...prev];
      next[ci] = { ...next[ci], name };
      return next;
    });
  }

  function removeCategory(ci: number) {
    setCategories((prev) => prev.filter((_, i) => i !== ci));
  }

  function addItem(ci: number) {
    setCategories((prev) => {
      const next = [...prev];
      next[ci] = { ...next[ci], items: [...next[ci].items, { name: '', price: 0 }] };
      return next;
    });
  }

  function addCategory() {
    setCategories((prev) => [...prev, { name: '', items: [] }]);
  }

  async function handlePublish() {
    const valid = categories
      .map((c) => ({ ...c, items: c.items.filter((i) => i.name.trim()) }))
      .filter((c) => c.name.trim() && c.items.length > 0);
    if (valid.length === 0) {
      setError('Nothing to publish - every category needs a name and at least one item');
      return;
    }
    setPublishing(true);
    setError('');
    try {
      const res = await publishMenuAi(businessId, valid);
      setPublishSummary({ categoriesCreated: res.categoriesCreated, itemsCreated: res.itemsCreated });
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish the menu');
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    setFiles([]);
    setHasResult(false);
    setWarnings([]);
    setUnclear([]);
    setImageSlots([]);
    setCategories([]);
    setPublishSummary(null);
    setError('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Section title="Upload menu with AI">
        <p className="text-base text-ivory-dim">
          Upload a PDF, Excel file, or photos of your menu and the system will read it and draft the
          full menu — categories, items, prices, and descriptions where the source already has them.
          You always review and confirm everything before it goes live.
        </p>
        <ActionButton onClick={() => setOpen(true)}>Upload menu</ActionButton>
      </Section>
    );
  }

  if (publishSummary) {
    return (
      <Section title="Menu published">
        <p className="text-base text-ivory">
          Created {publishSummary.categoriesCreated} categor{publishSummary.categoriesCreated === 1 ? 'y' : 'ies'} and{' '}
          {publishSummary.itemsCreated} item{publishSummary.itemsCreated === 1 ? '' : 's'}.
        </p>
        <ActionButton onClick={reset}>Done</ActionButton>
      </Section>
    );
  }

  // Step 2: review screen, once we have a draft back.
  if (hasResult) {
    return (
      <Section title="Review before publishing">
        <p className="text-base text-ivory-dim">
          Nothing is live yet — check every item below, fix anything that's wrong, then publish.
        </p>

        {warnings.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            {warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {unclear.length > 0 && (
          <div className="space-y-3 rounded-lg border border-danger/40 bg-danger/10 p-4">
            <p className="text-sm text-danger">
              {unclear.length} photo{unclear.length === 1 ? '' : 's'} couldn't be read clearly —
              upload a better copy of each to include it. Only that one photo gets re-read, not the
              whole upload, so fixing this doesn't cost you for the photos that already came out fine.
            </p>
            {unclear.map((u) => (
              <div key={u.imageIndex} className="flex items-center justify-between gap-3 rounded-lg border border-ink-line bg-ink px-4 py-3">
                <div>
                  <p className="text-sm text-ivory">Photo {u.imageIndex + 1}</p>
                  <p className="text-xs text-ivory-dim">{retryingSlot === u.imageIndex ? 'Re-reading…' : u.reason}</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass hover:bg-brass/10">
                  Re-upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={retryingSlot !== null}
                    onChange={(e) => retryUnclearSlot(u.imageIndex, e)}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {categories.map((category, ci) => (
            <div key={ci} className="rounded-xl border border-ink-line p-4">
              <div className="flex items-center gap-2">
                <input
                  value={category.name}
                  onChange={(e) => updateCategoryName(ci, e.target.value)}
                  placeholder="Category name"
                  className="flex-1 rounded-lg border border-ink-line bg-ink px-3 py-2 text-base font-medium text-ivory"
                />
                <button onClick={() => removeCategory(ci)} className="shrink-0 text-sm text-danger">Remove</button>
              </div>

              <div className="mt-3 space-y-3">
                {category.items.map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3 rounded-lg border border-ink-line bg-ink-soft p-3">
                    {item.photoUrl && (
                      <img src={item.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    )}
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(ci, ii, { name: e.target.value })}
                        placeholder="Item name"
                        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(ci, ii, { price: Number(e.target.value) })}
                          placeholder="Price"
                          className="w-24 rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
                        />
                        {item.currency && (
                          <span className="flex items-center rounded-lg border border-warning/40 bg-warning/10 px-2 text-xs text-warning">
                            {item.currency} — check this converts correctly to AED
                          </span>
                        )}
                      </div>
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => updateItem(ci, ii, { description: e.target.value })}
                        placeholder="Description (leave blank if none)"
                        rows={2}
                        className="w-full rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm text-ivory"
                      />
                    </div>
                    <button onClick={() => removeItem(ci, ii)} className="shrink-0 text-xs text-danger">Remove</button>
                  </div>
                ))}
                <button onClick={() => addItem(ci)} className="text-sm text-brass hover:underline">+ Add item</button>
              </div>
            </div>
          ))}
          <button onClick={addCategory} className="text-sm text-brass hover:underline">+ Add category</button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="button" onClick={handlePublish} disabled={publishing || extracting}>
            {publishing ? 'Publishing…' : 'Publish menu'}
          </PrimaryButton>
          <ActionButton onClick={reset}>Cancel</ActionButton>
        </div>
      </Section>
    );
  }

  // Step 1: file picking.
  return (
    <Section title="Upload menu with AI">
      <p className="text-base text-ivory-dim">
        Upload a PDF, Excel file, or photos of your menu. Descriptions are only included if your menu
        already has them, and photos are only pulled from real photos in your upload — nothing is
        invented. You'll review everything before it's published.
      </p>

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-ink-line px-6 py-10 text-center hover:border-brass/40">
        <input type="file" multiple accept={ACCEPT} className="hidden" onChange={handleFilePick} />
        <p className="text-base text-ivory">Tap to choose files</p>
        <p className="mt-1 text-xs text-ivory-dim">PDF, Excel/CSV, or multiple photos</p>
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-ink-line bg-ink-soft px-4 py-2 text-sm">
              <span className="text-ivory">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-danger">Remove</button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <PrimaryButton type="button" onClick={() => runExtraction(files)} disabled={files.length === 0 || extracting}>
          {extracting ? 'Reading menu…' : 'Extract menu'}
        </PrimaryButton>
        <ActionButton onClick={reset}>Cancel</ActionButton>
      </div>
    </Section>
  );
}
