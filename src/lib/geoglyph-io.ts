/**
 * Geogaddi Fingerprint I/O System
 * Handles lossless SVG steganography for fingerprint exchange.
 */

/**
 * Metadata colors for the 8-color 3-bit encoding logic
 */
const DATA_COLORS = [
  '#000000', // 000
  '#FFFFFF', // 001
  '#00FF41', // 010 (Green)
  '#FC3D21', // 011 (Red)
  '#0066FF', // 100 (Blue)
  '#FFB800', // 101 (Amber)
  '#D400FF', // 110 (Purple)
  '#40E0D0', // 111 (Turquoise)
];

export const generateGeoglyphSVG = (seed: number[], payload: string, requiresCartridge: boolean = false, size: number = 300): string => {
  const center = size / 2;
  const nSpines = (seed[0] % 11) + 5;
  const nRings = (seed[1] % 3) + 2;
  const nSamples = 180;

  // Header and Metadata embedding
  // We encode the payload directly in a metadata comment for zero-loss recovery
  const metadata = `<!-- GEOGADDI_CIPHER_STREAM:${payload} -->\n  <!-- GEOGADDI_CARTRIDGE_REQUIRED:${requiresCartridge} -->`;

  let svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background:#000000;">`;
  svgContent += `\n  ${metadata}\n`;

  // Draw Background Grids
  svgContent += `  <g stroke="rgba(255, 0, 0, 0.2)" stroke-width="0.5" fill="none">\n`;
  for (let r = 40; r < size / 2; r += 20) {
    svgContent += `    <circle cx="${center}" cy="${center}" r="${r}" />\n`;
  }
  svgContent += `  </g>\n`;

  // --- NEW: High-Density Optical Data Rings ---
  // We encode the ciphertext bits into visual blocks for Gemini/OCR reconstruction
  // This allows recovery from a screenshot (PNG/JPG)
  try {
    const rawBinary = atob(payload);
    const bits: number[] = [];
    for (let i = 0; i < rawBinary.length; i++) {
        const byte = rawBinary.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
            bits.push((byte >> b) & 1);
        }
    }

    // 3 bits per block = 8 colors
    const blocks: number[] = [];
    for (let i = 0; i < bits.length; i += 3) {
        let val = 0;
        if (bits[i] !== undefined) val |= (bits[i] << 2);
        if (bits[i+1] !== undefined) val |= (bits[i+1] << 1);
        if (bits[i+2] !== undefined) val |= (bits[i+2] << 0);
        blocks.push(val);
    }

    const blocksPerRing = 180;
    const nDataRings = Math.ceil(blocks.length / blocksPerRing);
    
    svgContent += `  <g id="OPTICAL_DATA_LAYER">\n`;
    
    // CALIBRATION HEADER: 8 blocks with the reference colors for the Vision AI
    for (let cIdx = 0; cIdx < 8; cIdx++) {
        const ringRadius = (size / 2) - 10;
        const thetaStart = (cIdx / 360) * Math.PI * 2;
        const thetaEnd = ((cIdx + 1) / 360) * Math.PI * 2;
        const x1 = center + ringRadius * Math.cos(thetaStart);
        const y1 = center + ringRadius * Math.sin(thetaStart);
        const x2 = center + ringRadius * Math.cos(thetaEnd);
        const y2 = center + ringRadius * Math.sin(thetaEnd);
        svgContent += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DATA_COLORS[cIdx]}" stroke-width="6" />\n`;
    }

    for (let rIdx = 0; rIdx < nDataRings; rIdx++) {
        const ringRadius = (size / 2) - 10 - (rIdx * 5);
        // Offset data by calibration header in the first ring
        const startOffset = rIdx === 0 ? 8 : 0;
        for (let bIdx = startOffset; bIdx < blocksPerRing; bIdx++) {
            const dataIdx = (rIdx * blocksPerRing) + (bIdx - startOffset);
            if (dataIdx >= blocks.length) break;
            
            const color = DATA_COLORS[blocks[dataIdx]];
            const thetaStart = (bIdx / blocksPerRing) * Math.PI * 2;
            const thetaEnd = ((bIdx + 1) / blocksPerRing) * Math.PI * 2;
            
            const x1 = center + ringRadius * Math.cos(thetaStart);
            const y1 = center + ringRadius * Math.sin(thetaStart);
            const x2 = center + ringRadius * Math.cos(thetaEnd);
            const y2 = center + ringRadius * Math.sin(thetaEnd);
            
            svgContent += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" />\n`;
        }
    }
    svgContent += `  </g>\n`;
  } catch (e) {
      console.error("Optical data encoding failed", e);
  }

  // Draw Central Spines
  svgContent += `  <g stroke="#40E0D0" stroke-width="1.0" opacity="0.8">\n`;
  for (let i = 0; i < nSpines; i++) {
    const sByte = seed[(i + 5) % seed.length] || 0;
    const theta = (i / nSpines) * Math.PI * 2;
    const spineLength = size * 0.08 + (sByte % 15);
    const xEnd = center + spineLength * Math.cos(theta);
    const yEnd = center + spineLength * Math.sin(theta);
    svgContent += `    <line x1="${center}" y1="${center}" x2="${xEnd}" y2="${yEnd}" />\n`;
    if (sByte > 128) {
        const nx = center + (spineLength * 0.7) * Math.cos(theta);
        const ny = center + (spineLength * 0.7) * Math.sin(theta);
        svgContent += `    <rect x="${nx - 1.5}" y="${ny - 1.5}" width="3" height="3" fill="#40E0D0" stroke="none" />\n`;
    }
  }
  svgContent += `  </g>\n`;

  // Draw Radial Spectral Data
  svgContent += `  <g opacity="0.9">\n`;
  for (let i = 0; i < nSamples; i++) {
    const theta = (i / nSamples) * Math.PI * 2;
    const dataIndex = i % seed.length;
    const rawValue = seed[dataIndex];
    const spectralHeight = 30 + (rawValue % 120);
    const startR = size * 0.14;
    const endR = startR + spectralHeight;

    const xStart = center + startR * Math.cos(theta);
    const yStart = center + startR * Math.sin(theta);
    const xEnd = center + endR * Math.cos(theta);
    const yEnd = center + endR * Math.sin(theta);

    let color = '#FF1E1E';
    let width = 0.6;
    if (rawValue > 190) {
      color = '#FF8C00';
      width = 1.8;
    } else if (rawValue > 100) {
      color = '#D400FF';
      width = 0.8;
    }

    svgContent += `    <line x1="${xStart}" y1="${yStart}" x2="${xEnd}" y2="${yEnd}" stroke="${color}" stroke-width="${width}" />\n`;

    // Blips
    if (rawValue > 160 || i % 15 === 0) {
      const blipR = startR + (rawValue % (endR - startR));
      const xBlip = center + blipR * Math.cos(theta);
      const yBlip = center + blipR * Math.sin(theta);
      const bColor = rawValue > 220 ? '#FFFFFF' : (rawValue > 140 ? '#FF8C00' : '#FF0000');
      const bSize = rawValue > 240 ? 5 : 3;
      svgContent += `    <rect x="${xBlip - bSize/2}" y="${yBlip - bSize/2}" width="${bSize}" height="${bSize}" fill="${bColor}" stroke="none" />\n`;
    }
  }
  svgContent += `  </g>\n`;

  // Draw Blue Rings
  svgContent += `  <g stroke="#0066FF" stroke-width="1.6" fill="none">\n`;
  for (let j = 0; j < nRings; j++) {
    const ringR = 40 + (j * 20) + (seed[(32 + j) % seed.length] % 20);
    svgContent += `    <circle cx="${center}" cy="${center}" r="${ringR}" />\n`;
  }
  svgContent += `  </g>\n`;

  svgContent += `</svg>`;
  return svgContent;
};

export const parseGeoglyphSVG = (svgContent: string): { payload: string | null, requiresCartridge: boolean } => {
  try {
    const payloadMatch = svgContent.match(/GEOGADDI_CIPHER_STREAM:([A-Za-z0-9+/=]+)/);
    const cartridgeMatch = svgContent.match(/GEOGADDI_CARTRIDGE_REQUIRED:(true|false)/);
    
    return {
      payload: payloadMatch ? payloadMatch[1] : null,
      requiresCartridge: cartridgeMatch ? cartridgeMatch[1] === 'true' : false
    };
  } catch (e) {
    console.error("Failed to parse Geoglyph SVG:", e);
    return { payload: null, requiresCartridge: false };
  }
};
