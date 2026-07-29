import { useEffect, useRef, useState } from 'react';

// Real physical proportions of the actual manufactured stand, not
// invented: 85mm wide x 100mm tall main face, with a 40mm base that
// folds backward to let it stand upright on its own - confirmed exact
// measurements, scaled here at roughly 3.2px per mm for a good screen
// presence without dominating the hero section.
const SCALE = 3.2;
const FACE_W = 85 * SCALE;
const FACE_H = 100 * SCALE;
const BASE_D = 40 * SCALE;
// The base folds back at a bit more than a right angle so the card leans
// back slightly and stays balanced - matches the real standee's actual
// resting angle, not an arbitrary number.
const BASE_FOLD_DEG = 100;
// How far the camera looks down on the whole object. -8deg was too
// shallow - at that angle the folded base (already tilted ~100deg back)
// foreshortens to almost nothing, so the "stand" part never actually
// read as visible even though it was correctly rendered. -24deg gives
// enough of a top-down look to actually see the fold, still reads as a
// natural product-shot angle rather than looking down flat on it.
const CAMERA_TILT_DEG = -24;

export default function Card3D() {
  const [angle, setAngle] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastTsRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    function tick(ts: number) {
      if (lastTsRef.current === undefined) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      // A full rotation every ~9 seconds - slow enough to actually read
      // the design as it turns, not just a blur.
      setAngle((a) => (a + dt * 0.04) % 360);
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // A light sheen that sweeps across whichever face is currently toward
  // the viewer, synced to the real rotation angle rather than a canned
  // CSS animation running independently of the actual turn - this is
  // what reads as "glossy" rather than "a flat image spinning."
  const normalized = ((angle % 360) + 360) % 360;
  const facingFront = normalized < 90 || normalized > 270;
  const sheenProgress = facingFront
    ? (normalized <= 90 ? normalized : normalized - 360) / 90
    : (normalized - 180) / 90;
  const sheenX = 50 + sheenProgress * 70;

  return (
    <div
      className="mx-auto flex items-center justify-center"
      style={{
        perspective: '1400px',
        // Enough headroom for the folded base to swing fully into view
        // as the object rotates on Y, and enough width for it to swing
        // sideways too - the old +60 / *0.6 allowance was too tight and
        // let the ancestor's overflow-hidden clip the base at several
        // angles, which is why the fold never seemed to appear.
        height: FACE_H + BASE_D + 40,
        width: FACE_W + BASE_D * 1.6,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: FACE_W,
          height: FACE_H,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${CAMERA_TILT_DEG}deg) rotateY(${angle}deg)`,
        }}
      >
        {/* Front - the real, actual uploaded design. `contain` (not
            `cover`) so the full artwork always shows regardless of the
            source PNG's exact aspect ratio - `cover` was cropping edges
            of the design whenever it didn't match the 85:100 face
            exactly. Matching background color fills any letterbox
            sliver instead of leaving it transparent. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            backgroundImage: 'url(/brand/card-front.png)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#f4eee3',
            backfaceVisibility: 'hidden',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          {facingFront && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(115deg, transparent ${sheenX - 25}%, rgba(255,255,255,0.35) ${sheenX}%, transparent ${sheenX + 25}%)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* Back - deliberately blank, per confirmation; a subtle brand
            mark only, so the object never looks "unfinished" from behind */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            background: '#f4eee3',
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: '#b8925a', opacity: 0.5 }}>T</span>
          {!facingFront && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(115deg, transparent ${sheenX - 25}%, rgba(255,255,255,0.5) ${sheenX}%, transparent ${sheenX + 25}%)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* The folded base - real shape, confirmed blank. Rotation sign
            verified mathematically: origin at 'top' (the crease shared
            with the front face), so a NEGATIVE rotateX pushes the far
            edge into negative-Z (away from the viewer) - a positive
            value here folds it forward instead, which was the exact bug
            in the previous version. backfaceVisibility hidden too, so
            it correctly disappears rather than rendering through the
            card at angles where it shouldn't be visible at all. */}
        <div
          style={{
            position: 'absolute',
            top: FACE_H,
            left: 0,
            width: FACE_W,
            height: BASE_D,
            background: '#f4eee3',
            transformOrigin: 'top',
            transform: `rotateX(${BASE_FOLD_DEG - 180}deg)`,
            backfaceVisibility: 'hidden',
            boxShadow: 'inset 0 8px 12px -8px rgba(0,0,0,0.25)',
            borderRadius: '0 0 10px 10px',
          }}
        />
      </div>
    </div>
  );
}