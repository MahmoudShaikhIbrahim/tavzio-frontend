import { useState, type ChangeEvent } from 'react';
import {
  extractMenuAi, publishMenuAi,
  type MenuAiDraftCategory,
} from '../lib/authApi';
import { Section, PrimaryButton, ActionButton } from './ui';
import { uploadBusinessFile } from '../lib/supabaseClient';

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

  const [replacingPhoto, setReplacingPhoto] = useState<string | null>(null);

  // The actual reliable fix for a bad crop: upload the correct photo
  // directly, bypassing AI cropping entirely for this item. Works
  // regardless of how the source menu was structured or how confident
  // the AI was - a manual replacement can never come out wrong the way
  // an automated crop occasionally will.
  async function replaceItemPhoto(ci: number, ii: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const key = `${ci}-${ii}`;
    setReplacingPhoto(key);
    setError('');
    try {
      const url = await uploadBusinessFile(businessId, file, `menu-ai-manual/${Date.now()}-${ci}-${ii}`);
      updateItem(ci, ii, { photoUrl: url, lowResPhoto: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo');
    } finally {
      setReplacingPhoto(null);
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
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            {warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {unclear.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-danger/40 bg-danger/10 p-4">
            <p className="text-sm text-danger">
              {unclear.length} photo{unclear.length === 1 ? '' : 's'} couldn't be read clearly —
              upload a better copy of each to include it. Only that one photo gets re-read, not the
              whole upload, so fixing this doesn't cost you for the photos that already came out fine.
            </p>
            {unclear.map((u) => (
              <div key={u.imageIndex} className="flex items-center justify-between gap-3 rounded-2xl border border-ink-line bg-ink px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm text-ivory">Photo {u.imageIndex + 1}</p>
                  <p className="text-xs text-ivory-dim">{retryingSlot === u.imageIndex ? 'Re-reading…' : u.reason}</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-full border border-brass/40 px-3 py-1.5 text-xs text-brass hover:bg-brass/10 focus-within:ring-2 focus-within:ring-brass">
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
            <div key={ci} className="rounded-2xl border border-ink-line p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <input
                  value={category.name}
                  onChange={(e) => updateCategoryName(ci, e.target.value)}
                  placeholder="Category name"
                  className="flex-1 rounded-full border border-ink-line bg-ink px-4 py-2 text-base font-medium text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                />
                <button type="button" onClick={() => removeCategory(ci)} className="shrink-0 rounded-full px-2 py-1 text-sm text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Remove</button>
              </div>

              <div className="mt-3 space-y-3">
                {category.items.map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3 rounded-2xl border border-ink-line bg-ink-soft p-3.5 shadow-sm">
                    <div className="w-14 shrink-0 space-y-1">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-ink-line text-[10px] text-ivory-dim">
                          no photo
                        </div>
                      )}
                      {item.lowResPhoto && (
                        <p className="text-center text-[10px] leading-tight text-warning">may look soft</p>
                      )}
                      <label className="block cursor-pointer rounded-full text-center text-xs font-medium leading-tight text-brass hover:underline focus-within:ring-2 focus-within:ring-brass">
                        {replacingPhoto === `${ci}-${ii}` ? 'Uploading…' : item.photoUrl ? 'Replace' : 'Add photo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={replacingPhoto !== null}
                          onChange={(e) => replaceItemPhoto(ci, ii, e)}
                        />
                      </label>
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(ci, ii, { name: e.target.value })}
                        placeholder="Item name"
                        className="w-full rounded-full border border-ink-line bg-ink px-3.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          onFocus={(e) => e.target.select()}
                          value={item.price}
                          onChange={(e) => updateItem(ci, ii, { price: Number(e.target.value) })}
                          placeholder="Price"
                          className="w-24 rounded-full border border-ink-line bg-ink px-3.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                        />
                        {item.currency && (
                          <span className="flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 text-xs text-warning">
                            {item.currency} — check this converts correctly to AED
                          </span>
                        )}
                      </div>
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => updateItem(ci, ii, { description: e.target.value })}
                        placeholder="Description (leave blank if none)"
                        rows={2}
                        className="w-full rounded-2xl border border-ink-line bg-ink px-3.5 py-1.5 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                      />
                    </div>
                    <button type="button" onClick={() => removeItem(ci, ii)} className="shrink-0 rounded-full px-2 py-1 text-xs text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addItem(ci)} className="rounded-full px-1 text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">+ Add item</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addCategory} className="rounded-full px-1 text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass">+ Add category</button>
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

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-ink-line px-6 py-10 text-center hover:border-brass/40 focus-within:ring-2 focus-within:ring-brass">
        <input type="file" multiple accept={ACCEPT} className="hidden" onChange={handleFilePick} />
        <p className="text-base text-ivory">Tap to choose files</p>
        <p className="mt-1 text-xs text-ivory-dim">PDF, Excel/CSV, or multiple photos</p>
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl border border-ink-line bg-ink-soft px-4 py-2.5 text-sm shadow-sm">
              <span className="text-ivory">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} className="rounded-full px-2 py-1 text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Remove</button>
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
