  import { ImagePlus, Sparkles, Wand2 } from "lucide-react";

interface PresetCard {
  id: string;
  label: string;
  description: string;
}

interface GalleryCard {
  id: string;
  label: string;
  imageUrl: string;
}

interface InspirationShelfProps {
  presets: PresetCard[];
  galleryItems: GalleryCard[];
  onSelectPreset: (presetId: string) => void;
  onReuseGalleryItem: (taskId: string) => void;
  onOpenUploads: () => void;
}

export function InspirationShelf({ presets, galleryItems, onSelectPreset, onReuseGalleryItem, onOpenUploads }: InspirationShelfProps) {
  return (
    <section className="inspiration-shelf" aria-label="灵感浏览">
      <div className="inspiration-shelf-head">
        <h2>灵感浏览</h2>
        <span>先用一版方向把封面跑出来，再慢慢收敛细节。</span>
      </div>

      <div className="inspiration-grid">
        <button type="button" className="inspiration-card upload" onClick={onOpenUploads}>
          <div className="inspiration-icon-badge">
            <ImagePlus size={22} />
          </div>
          <strong>上传照片</strong>
          <span>先放头像、参考图或素材图，让第一版更接近你的审美。</span>
        </button>

        {presets.map((preset) => (
          <button key={preset.id} type="button" className="inspiration-card preset" onClick={() => onSelectPreset(preset.id)}>
            <div className="inspiration-icon-badge">
              <Sparkles size={20} />
            </div>
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}

        {galleryItems.map((item) => (
          <button key={item.id} type="button" className="inspiration-card gallery" onClick={() => onReuseGalleryItem(item.id)}>
            <img src={item.imageUrl} alt={item.label} />
            <div className="inspiration-card-overlay">
              <div className="inspiration-icon-badge compact">
                <Wand2 size={14} />
              </div>
              <strong>{item.label}</strong>
              <span>继续优化这轮结果</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
