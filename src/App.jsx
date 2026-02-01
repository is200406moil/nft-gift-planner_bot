// App.js - Main component for NFT Gift Planner
import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import './App.css'; // Assume CSS file for styles
import Modal from 'react-modal'; // For modals, install react-modal
import html2canvas from 'html2canvas'; // For export, install html2canvas
import lottie from 'lottie-web';
import pako from 'pako';

Modal.setAppElement('#root');

const API_BASE = 'https://api.changes.tg';

// Animation cache for prefetched TGS data
const animationCache = new Map();

// Prefetch animation data for instant playback
async function prefetchAnimation(gift, model) {
  const cacheKey = `${gift}/${model}`;
  if (animationCache.has(cacheKey)) {
    return animationCache.get(cacheKey);
  }
  
  try {
    const tgsUrl = `${API_BASE}/model/${normalizeGiftName(gift)}/${model}.tgs`;
    const response = await fetch(tgsUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
    const animationData = JSON.parse(decompressed);
    
    animationCache.set(cacheKey, animationData);
    return animationData;
  } catch (error) {
    console.warn(`Failed to prefetch animation for ${cacheKey}:`, error);
    return null;
  }
}

function normalizeGiftName(name) {
  return name.toLowerCase().replace(/ /g, '-');
}

/**
 * Aggressively normalize a string for key matching (removes all non-alphanumeric)
 */
function aggressiveNormalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get the image URL for a gift - uses model endpoint if model is selected, 
 * otherwise falls back to /original endpoint using giftId.
 * @param {string} gift - Gift name (e.g., "Santa Hat")
 * @param {string|null} model - Model name if upgraded, null/empty if not
 * @param {Object} giftIds - Map of gift names (normalized variants) to gift IDs
 * @param {number} size - Image size (default 256)
 * @returns {string|null} Image URL or null if gift ID not found
 */
function getGiftImageUrl(gift, model, giftIds, size = 256) {
  if (!gift) return null;
  
  console.log('[getGiftImageUrl] called', { gift, model });

  // If model is selected, use the model endpoint
  if (model && model.trim() !== '') {
    const normGift = normalizeGiftName(gift);
    const url = `${API_BASE}/model/${normGift}/${model}.png?size=${size}`;
    console.log('[getGiftImageUrl] → model URL:', url);
    return url;
  }

  // Fallback to /original endpoint using gift ID
  // Try multiple key variants to find giftId in the name→id mapping
  const variants = [
    gift,                                    // Original: "Santa Hat"
    gift.toLowerCase(),                      // Lowercase: "santa hat"
    normalizeGiftName(gift),                 // Dashed: "santa-hat"
    aggressiveNormalize(gift),               // Aggressive: "santahat"
    gift.replace(/ /g, ''),                  // No spaces: "SantaHat"
    gift.toLowerCase().replace(/ /g, '_'),   // Underscored: "santa_hat"
  ];

  let giftId = null;
  for (const variant of variants) {
    if (giftIds[variant]) {
      giftId = giftIds[variant];
      console.log('[getGiftImageUrl] → found gift ID via variant:', variant, '→', giftId);
      break;
    }
  }

  if (giftId) {
    const url = `${API_BASE}/original/${giftId}.png?size=${size}`;
    console.log('[getGiftImageUrl] → original URL:', url);
    return url;
  }

  console.warn('[getGiftImageUrl] No gift ID found for:', gift, '| Tried variants:', variants);
  return null;
}

// SortableCell component using @dnd-kit
const SortableCell = ({ id, cell, rowIndex, colIndex, isPlaying, animationMode, onCellClick, isOver, giftIds }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id });

  // DO NOT apply transform - keep cell in original position during drag
  // The ghost (DragOverlay) follows the cursor instead

  // Determine cell state classes
  const cellClasses = [
    'cell',
    isDragging ? 'cell-dragging' : '',
    isOver && !isDragging ? 'cell-drop-target' : '',
  ].filter(Boolean).join(' ');

  // Get image URL - model if selected, otherwise original fallback
  const imageUrl = cell?.gift ? getGiftImageUrl(cell.gift, cell.model, giftIds) : null;
  
  // Get giftId for non-upgraded gift animation (try multiple key variants)
  const getGiftIdForAnimation = (giftName) => {
    if (!giftName) return null;
    const variants = [
      giftName,
      giftName.toLowerCase(),
      normalizeGiftName(giftName),
      aggressiveNormalize(giftName),
    ];
    for (const variant of variants) {
      if (giftIds[variant]) return giftIds[variant];
    }
    return null;
  };
  
  const giftId = cell?.gift && !cell?.model ? getGiftIdForAnimation(cell.gift) : null;

  return (
    <div
      ref={setNodeRef}
      className={cellClasses}
      onClick={() => onCellClick(rowIndex, colIndex)}
      {...attributes}
      {...listeners}
    >
      {cell ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {cell.backdrop && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to bottom, ${cell.backdrop.hex?.edgeColor || '#000'}, ${cell.backdrop.hex?.centerColor || '#333'})`,
              }}
            />
          )}
          {cell?.pattern && cell?.gift && (
            <PatternRings gift={cell.gift} pattern={cell.pattern} cellId={id} />
          )}
          {cell?.gift && (
            <>
              {isPlaying && animationMode && (cell.model || giftId) ? (
                <TgsAnimation 
                  gift={cell.gift} 
                  model={cell.model}
                  giftId={giftId}
                />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="gift"
                  onError={(e) => {
                    console.error('[SortableCell] Image load error:', imageUrl);
                    e.target.style.display = 'none';
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    zIndex: 2,
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(100, 100, 100, 0.3)',
                    color: '#888',
                    fontSize: '12px',
                    textAlign: 'center',
                    zIndex: 2,
                  }}
                >
                  {cell.gift}<br/>(no image)
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <span className="empty-cell">Empty</span>
      )}
    </div>
  );
};

function App() {
  const [rows, setRows] = useState(3); // Start with 3 rows
  const [grid, setGrid] = useState(Array.from({ length: 3 }, () => Array(3).fill(null))); // null for empty cells
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState([]);
  const [backdrops, setBackdrops] = useState([]);
  const [giftIds, setGiftIds] = useState({}); // Map of gift name -> gift ID for /original endpoint
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState({ row: -1, col: -1 });
  const [copiedCell, setCopiedCell] = useState(null);
  const [modelsCache, setModelsCache] = useState({});
  const [patternsCache, setPatternsCache] = useState({});
  const [animationMode, setAnimationMode] = useState(false);
  const [playingAnimations, setPlayingAnimations] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Generate unique IDs for cells
  const cellIds = grid.flat().map((_, index) => `cell-${index}`);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    try {
      // Load gifts from API - no hardcoded fallback
      const giftsData = await safeFetch('/gifts', []);
      setGifts(giftsData);

      // Load backdrops from API
      const backdropsData = await safeFetch('/backdrops', []);
      setBackdrops(backdropsData);

      // Load gift name → id mapping for /original endpoint fallback
      // Try /names first (should be name → id), fall back to inverting /ids (which is id → name)
      let namesData = await safeFetch('/names', {});
      console.log('[loadInitialData] /names sample entries:', Object.entries(namesData).slice(0, 3));
      
      // Check if namesData looks like name → id (values should be numeric string IDs)
      const firstValue = Object.values(namesData)[0];
      const looksLikeNameToId = typeof firstValue === 'string' && /^\d+$/.test(firstValue);
      console.log('[loadInitialData] /names looks like name→id:', looksLikeNameToId);
      
      let nameToId = {};
      
      if (looksLikeNameToId) {
        // /names is already name → id
        nameToId = namesData;
        console.log('[loadInitialData] Using /names directly as name→id');
      } else {
        // /names might be id → name (same as /ids), need to invert
        // Or fetch /ids and invert it
        const idsData = await safeFetch('/ids', {});
        console.log('[loadInitialData] /ids sample entries:', Object.entries(idsData).slice(0, 3));
        
        // /ids is id → name, we need name → id
        for (const [id, name] of Object.entries(idsData)) {
          if (typeof name !== 'string') continue;
          nameToId[name] = id;
        }
        console.log('[loadInitialData] Inverted /ids to name→id');
      }
      
      // Now normalize the keys for flexible lookup
      const normalizedNameToId = {};
      for (const [name, id] of Object.entries(nameToId)) {
        if (typeof name !== 'string') continue;
        
        // Store multiple variants of each name for flexible matching
        const variants = [
          name,                                    // Original: "Santa Hat"
          name.toLowerCase(),                      // Lowercase: "santa hat"
          normalizeGiftName(name),                 // Dashed: "santa-hat"
          aggressiveNormalize(name),               // Aggressive: "santahat"
          name.replace(/ /g, ''),                  // No spaces: "SantaHat"
          name.toLowerCase().replace(/ /g, '_'),   // Underscored: "santa_hat"
        ];
        
        for (const variant of variants) {
          normalizedNameToId[variant] = id;
        }
      }
      
      console.log('[loadInitialData] Normalized nameToId count:', Object.keys(normalizedNameToId).length);
      console.log('[loadInitialData] Sample nameToId entries:', 
        Object.entries(normalizedNameToId).slice(0, 8).map(([k, v]) => `${k} → ${v}`));
      setGiftIds(normalizedNameToId);

      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const safeFetch = async (endpoint, fallback = []) => {
    const cacheKey = endpoint.replace(/[^a-zA-Z0-9]/g, '_');
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          cache: 'no-store',
          mode: 'cors',
          headers: {
            'Connection': 'close',
            'User-Agent': 'NFT-Gift-Planner/1.0'
          }
        });
  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
        const data = await response.json();
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      } catch (error) {
        console.warn(`Attempt ${attempt}/${maxRetries} failed for ${endpoint}:`, error);
        if (attempt === maxRetries) {
          console.error(`Using fallback for ${endpoint}`);
          return fallback;
        }
        await new Promise(r => setTimeout(r, 800 * attempt)); // backoff
      }
    }
    return fallback;
  };

  const addRow = () => {
    // Limit to 5 rows when animation mode is active
    if (animationMode && rows >= 5) return;
    setRows(rows + 1);
    setGrid([...grid, Array(3).fill(null)]);
  };

  const removeRow = () => {
    if (rows <= 3) return;
    const newGrid = grid.slice(0, -1); // Remove last row
    setGrid(newGrid);
    setRows(rows - 1);
  };

  const openModal = (row, col) => {
    setCurrentCell({ row, col });
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const saveCell = (cellData) => {
    const newGrid = [...grid];
    newGrid[currentCell.row][currentCell.col] = cellData;
    setGrid(newGrid);
    closeModal();
  };

  const parseLink = (link) => {
    const match = link.match(/t\.me\/nft\/(.+?)-(\d+)/);
    if (match) {
      const name = match[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const giftNumber = match[2];
      return { name, giftNumber, slug: match[1] };
    }
    return null;
  };

  /**
   * Parse NFT page content to extract Model, Backdrop, Symbol
   * Handles multiple formats:
   * - Markdown table: | Model | Diamonds 0.5% |
   * - Text format: Model: Diamonds 0.5%
   */
  const parseNftPageContent = (text) => {
    const result = { model: '', backdrop: '', pattern: '' };
    
    // Log first 2000 chars of text for debugging
    console.log('[parseNftPageContent] Raw text (first 2000 chars):', text.substring(0, 2000));
    
    // Split into lines for line-by-line parsing
    const lines = text.split('\n').map(l => l.trim());
    console.log('[parseNftPageContent] Total lines:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Skip empty lines
      if (!line) continue;
      
      // Check for Model
      if (lineLower.includes('model') && !result.model) {
        // Try markdown table format: | Model | Diamonds 0.5% |
        let match = line.match(/\|\s*Model\s*\|\s*([^|]+?)\s*(?:\d+\.?\d*%\s*)?\|/i);
        if (!match) {
          // Try text format: Model: Diamonds 0.5%
          match = line.match(/Model\s*[:|]\s*([^%\n]+?)(?:\s+\d+\.?\d*%|$)/i);
        }
        if (!match) {
          // Try simple format without percentage
          match = line.match(/Model\s*[:|]\s*(.+)/i);
        }
        if (match && match[1]) {
          result.model = match[1].trim().replace(/\s*\d+\.?\d*%\s*$/, '').trim();
          console.log('[parseNftPageContent] Found model on line', i, ':', result.model, '| Line:', line);
        }
      }
      
      // Check for Backdrop
      if (lineLower.includes('backdrop') && !result.backdrop) {
        let match = line.match(/\|\s*Backdrop\s*\|\s*([^|]+?)\s*(?:\d+\.?\d*%\s*)?\|/i);
        if (!match) {
          match = line.match(/Backdrop\s*[:|]\s*([^%\n]+?)(?:\s+\d+\.?\d*%|$)/i);
        }
        if (!match) {
          match = line.match(/Backdrop\s*[:|]\s*(.+)/i);
        }
        if (match && match[1]) {
          result.backdrop = match[1].trim().replace(/\s*\d+\.?\d*%\s*$/, '').trim();
          console.log('[parseNftPageContent] Found backdrop on line', i, ':', result.backdrop, '| Line:', line);
        }
      }
      
      // Check for Symbol or Pattern
      if ((lineLower.includes('symbol') || lineLower.includes('pattern')) && !result.pattern) {
        let match = line.match(/\|\s*(?:Symbol|Pattern)\s*\|\s*([^|]+?)\s*(?:\d+\.?\d*%\s*)?\|/i);
        if (!match) {
          match = line.match(/(?:Symbol|Pattern)\s*[:|]\s*([^%\n]+?)(?:\s+\d+\.?\d*%|$)/i);
        }
        if (!match) {
          match = line.match(/(?:Symbol|Pattern)\s*[:|]\s*(.+)/i);
        }
        if (match && match[1]) {
          result.pattern = match[1].trim().replace(/\s*\d+\.?\d*%\s*$/, '').trim();
          console.log('[parseNftPageContent] Found pattern on line', i, ':', result.pattern, '| Line:', line);
        }
      }
    }
    
    console.log('[parseNftPageContent] Extracted result:', result);
    return result;
  };

  /**
   * Fetch NFT page and extract upgrade details
   * Uses CORS proxy to bypass browser restrictions
   */
  const fetchNftDetails = async (slug, giftNumber) => {
    const url = `https://t.me/nft/${slug}-${giftNumber}`;
    console.log('[fetchNftDetails] Fetching:', url);
    
    try {
      // Use a CORS proxy to fetch the Telegram page
      // Try multiple proxies in case one fails
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
      ];
      
      let html = null;
      for (const proxyUrl of proxies) {
        try {
          const response = await fetch(proxyUrl, { 
            cache: 'no-store',
            headers: { 'Accept': 'text/html' }
          });
          if (response.ok) {
            html = await response.text();
            console.log('[fetchNftDetails] Fetched via proxy:', proxyUrl.split('?')[0]);
            break;
          }
        } catch (proxyError) {
          console.warn('[fetchNftDetails] Proxy failed:', proxyError.message);
        }
      }
      
      if (!html) {
        console.warn('[fetchNftDetails] All proxies failed');
        return null;
      }
      
      // Parse the HTML to extract text content
      // The page content is in meta tags or page body
      const details = parseNftPageContent(html);
      return details;
    } catch (error) {
      console.error('[fetchNftDetails] Error:', error);
      return null;
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setOverId(over?.id || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    
    if (!over || active.id === over.id) return;

    const activeIndex = parseInt(active.id.replace('cell-', ''), 10);
    const overIndex = parseInt(over.id.replace('cell-', ''), 10);

    const sourceRow = Math.floor(activeIndex / 3);
    const sourceCol = activeIndex % 3;
    const destRow = Math.floor(overIndex / 3);
    const destCol = overIndex % 3;

    // Swap cells
    const newGrid = grid.map(row => [...row]);
    const temp = newGrid[destRow][destCol];
    newGrid[destRow][destCol] = newGrid[sourceRow][sourceCol];
    newGrid[sourceRow][sourceCol] = temp;
    setGrid(newGrid);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const toggleAnimationMode = () => {
    const newAnimationMode = !animationMode;
    setAnimationMode(newAnimationMode);
    
    // If turning on animation mode and rows > 5, remove excess rows
    if (newAnimationMode && rows > 5) {
      const newGrid = grid.slice(0, 5);
      setGrid(newGrid);
      setRows(5);
    }
  };

  const playAllAnimations = () => {
    // Find all cells with gifts (with model OR with giftId for original animation)
    const animations = {};
    
    // Helper to get giftId
    const getGiftIdForAnimation = (giftName) => {
      if (!giftName) return null;
      const variants = [
        giftName,
        giftName.toLowerCase(),
        normalizeGiftName(giftName),
        aggressiveNormalize(giftName),
      ];
      for (const variant of variants) {
        if (giftIds[variant]) return giftIds[variant];
      }
      return null;
    };
    
    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && cell.gift) {
          // Animation available if model is selected OR giftId exists for original
          const hasAnimation = cell.model || getGiftIdForAnimation(cell.gift);
          if (hasAnimation) {
            const key = `${rowIndex}-${colIndex}`;
            animations[key] = true;
          }
        }
      });
    });
    
    console.log('[playAllAnimations] Starting animations for cells:', Object.keys(animations));
    
    // Start all animations at once
    setPlayingAnimations(animations);
    
    // Stop all animations after duration
    setTimeout(() => {
      setPlayingAnimations({});
    }, 3000);
  };

  const isAnyAnimationPlaying = () => {
    return Object.keys(playingAnimations).length > 0;
  };

  const resetGrid = () => {
    setGrid(Array.from({ length: rows }, () => Array(3).fill(null)));
  };

  const exportGrid = () => {
    const gridElement = document.getElementById('grid');
    html2canvas(gridElement).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'nft_grid.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  // Get the active cell data for overlay
  const getActiveCellData = () => {
    if (!activeId) return null;
    const activeIndex = parseInt(activeId.replace('cell-', ''), 10);
    const rowIndex = Math.floor(activeIndex / 3);
    const colIndex = activeIndex % 3;
    return grid[rowIndex]?.[colIndex];
  };

  if (loading) {
    return <div className="splash">Loading...</div>;
  }

  return (
    <div className="app">
      <div className="controls">
        <div className="animation-toggle-container">
          <label>
            <input
              type="checkbox"
              checked={animationMode}
              onChange={toggleAnimationMode}
            />
            Анимация
          </label>
          <span 
            className="tooltip-icon" 
            title="ВНИМАНИЕ! При включенном режиме анимации сетка будет ограничена в 5 рядов."
          >
            ?
          </span>
        </div>
        {animationMode && (
          <button 
            onClick={playAllAnimations} 
            disabled={isAnyAnimationPlaying()}
            className="animate-all-button"
          >
            Анимировать всё
          </button>
        )}
        <button onClick={addRow} disabled={animationMode && rows >= 5}>
          Добавить ряд
        </button>
        <button onClick={removeRow} disabled={rows <= 3}>
          Удалить ряд
        </button>
        <button onClick={resetGrid}>Сброс</button>
        <button onClick={exportGrid}>Экспорт</button>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={cellIds} strategy={rectSortingStrategy}>
          <div id="grid" className="grid-container">
            {grid.flat().map((cell, flatIndex) => {
              const rowIndex = Math.floor(flatIndex / 3);
              const colIndex = flatIndex % 3;
              const isPlaying = playingAnimations[`${rowIndex}-${colIndex}`];
              const cellId = `cell-${flatIndex}`;
              return (
                <SortableCell
                  key={cellId}
                  id={cellId}
                  cell={cell}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                  isPlaying={isPlaying}
                  animationMode={animationMode}
                  onCellClick={openModal}
                  isOver={overId === cellId && activeId !== cellId}
                  giftIds={giftIds}
                />
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="cell cell-overlay">
              {(() => {
                const cellData = getActiveCellData();
                const overlayImageUrl = cellData?.gift ? getGiftImageUrl(cellData.gift, cellData.model, giftIds) : null;
                return cellData ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {cellData.backdrop && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: `linear-gradient(to bottom, ${cellData.backdrop.hex?.edgeColor || '#000'}, ${cellData.backdrop.hex?.centerColor || '#333'})`,
                        }}
                      />
                    )}
                    {cellData?.gift && overlayImageUrl ? (
                      <img
                        src={overlayImageUrl}
                        alt="gift"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          zIndex: 2,
                        }}
                      />
                    ) : cellData?.gift ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(100, 100, 100, 0.3)',
                          color: '#888',
                          fontSize: '12px',
                          textAlign: 'center',
                          zIndex: 2,
                        }}
                      >
                        {cellData.gift}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="empty-cell">Empty</span>
                );
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CellModal
        isOpen={modalIsOpen}
        onClose={closeModal}
        onSave={saveCell}
        gifts={gifts}
        backdrops={backdrops}
        modelsCache={modelsCache}
        patternsCache={patternsCache}
        setModelsCache={setModelsCache}
        setPatternsCache={setPatternsCache}
        normalizeGiftName={normalizeGiftName}
        safeFetch={safeFetch}
        parseLink={parseLink}
        fetchNftDetails={fetchNftDetails}
        copiedCell={copiedCell}
        setCopiedCell={setCopiedCell}
        initialData={grid[currentCell.row]?.[currentCell.col] || null}
      />
    </div>
  );
}

const CellModal = ({
  isOpen,
  onClose,
  onSave,
  gifts,
  backdrops,
  modelsCache,
  patternsCache,
  setModelsCache,
  setPatternsCache,
  normalizeGiftName,
  safeFetch,
  parseLink,
  fetchNftDetails,
  copiedCell,
  setCopiedCell,
  initialData,
}) => {
  const [link, setLink] = useState('');
  const [gift, setGift] = useState('');
  const [model, setModel] = useState('');
  const [backdrop, setBackdrop] = useState(null);
  const [pattern, setPattern] = useState('');
  const [models, setModels] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [parseStatus, setParseStatus] = useState('');

  // Reset modal state when it opens or when initialData changes
  useEffect(() => {
    if (isOpen) {
      setLink('');
      setGift(initialData?.gift || '');
      setModel(initialData?.model || '');
      setBackdrop(initialData?.backdrop || null);
      setPattern(initialData?.pattern || '');
      setModels([]);
      setPatterns([]);
      setIsInitialLoad(true);
      setIsParsingLink(false);
      setParseStatus('');
      
      // Load models and patterns for existing gift without resetting values
      if (initialData?.gift) {
        loadModelsAndPatterns(initialData.gift);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData]);

  const loadModelsAndPatterns = async (selectedGift) => {
    const norm = normalizeGiftName(selectedGift);
    let modelsData = modelsCache[selectedGift];
    if (!modelsData) {
      modelsData = await safeFetch(`/models/${norm}?sorted`, []);
      setModelsCache((prev) => ({ ...prev, [selectedGift]: modelsData }));
      sessionStorage.setItem(`models_${selectedGift}`, JSON.stringify(modelsData));
    }
    setModels(modelsData);

    let patternsData = patternsCache[selectedGift];
    if (!patternsData) {
      patternsData = await safeFetch(`/patterns/${norm}?sorted`, []);
      setPatternsCache((prev) => ({ ...prev, [selectedGift]: patternsData }));
      sessionStorage.setItem(`patterns_${selectedGift}`, JSON.stringify(patternsData));
    }
    setPatterns(patternsData);
  };

  // Handle gift changes - only reset dependent values when user manually changes gift
  const handleGiftChange = (newGift) => {
    if (newGift !== gift) {
      setGift(newGift);
      // Reset dependent values only when user changes gift (not on initial load)
      if (!isInitialLoad) {
        setModel('');
        setPattern('');
        setBackdrop(null);
      }
      setIsInitialLoad(false);
      setModels([]);
      setPatterns([]);
      if (newGift) {
        loadModelsAndPatterns(newGift);
      }
    }
  };

  const handleLink = async () => {
    const parsed = parseLink(link);
    if (!parsed) {
      setParseStatus('Неверный формат ссылки');
      return;
    }

    const { name, giftNumber, slug } = parsed;
    console.log('[handleLink] Parsed link:', { name, giftNumber, slug });
    
    // Set the gift name first
    setGift(name);
    setModels([]);
    setPatterns([]);
    setIsInitialLoad(false);
    
    // Load models and patterns for the gift
    await loadModelsAndPatterns(name);
    
    // Now fetch additional details from the NFT page
    setIsParsingLink(true);
    setParseStatus('Загрузка данных NFT...');
    
    try {
      const details = await fetchNftDetails(slug, giftNumber);
      
      if (details) {
        console.log('[handleLink] Fetched NFT details:', details);
        
        // Set model if found and exists in models list
        if (details.model) {
          setModel(details.model);
          setParseStatus(`Найдена модель: ${details.model}`);
          // Prefetch animation
          prefetchAnimation(name, details.model);
        }
        
        // Set pattern/symbol if found
        if (details.pattern) {
          setPattern(details.pattern);
        }
        
        // Set backdrop if found - need to find matching backdrop from backdrops list
        if (details.backdrop) {
          const matchingBackdrop = backdrops.find(b => 
            b.name.toLowerCase() === details.backdrop.toLowerCase() ||
            b.name.toLowerCase().includes(details.backdrop.toLowerCase()) ||
            details.backdrop.toLowerCase().includes(b.name.toLowerCase())
          );
          if (matchingBackdrop) {
            setBackdrop(matchingBackdrop);
            setParseStatus(prev => prev + `, фон: ${matchingBackdrop.name}`);
          }
        }
        
        if (!details.model && !details.pattern && !details.backdrop) {
          setParseStatus('Базовый подарок (без улучшений)');
        }
      } else {
        setParseStatus('Не удалось загрузить детали NFT');
      }
    } catch (error) {
      console.error('[handleLink] Error fetching details:', error);
      setParseStatus('Ошибка при загрузке данных');
    } finally {
      setIsParsingLink(false);
    }
  };

  const copyCell = () => {
    setCopiedCell({ gift, model, backdrop, pattern });
  };

  const pasteCell = () => {
    if (copiedCell) {
      // When pasting, we want to keep the pasted values, so use isInitialLoad-like behavior
      setGift(copiedCell.gift);
      setModel(copiedCell.model);
      setBackdrop(copiedCell.backdrop);
      setPattern(copiedCell.pattern);
      setModels([]);
      setPatterns([]);
      if (copiedCell.gift) {
        loadModelsAndPatterns(copiedCell.gift);
      }
    }
  };

  const handleSave = () => {
    onSave({ gift, model, backdrop, pattern });
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose}>
      <h2>Настройка ячейки</h2>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="t.me/nft/Name-123" />
      <button onClick={handleLink} disabled={isParsingLink}>
        {isParsingLink ? 'Загрузка...' : 'Распознать ссылку'}
      </button>
      {parseStatus && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          backgroundColor: 'rgba(100, 100, 255, 0.1)', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {parseStatus}
        </div>
      )}

      <select value={gift} onChange={(e) => handleGiftChange(e.target.value)}>
        <option value="">Выберите подарок</option>
        {gifts.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      {gift && (
        <>
          <select value={model} onChange={(e) => {
            const newModel = e.target.value;
            setModel(newModel);
            // Prefetch animation when model is selected for instant playback later
            if (newModel && gift) {
              prefetchAnimation(gift, newModel);
            }
          }}>
            <option value="">Выберите модель</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({(m.rarityPermille / 10).toFixed(1)}‰)</option>
            ))}
          </select>

          <select
            value={backdrop?.name || ''}
            onChange={(e) => {
              const selected = backdrops.find(b => b.name === e.target.value);
              setBackdrop(selected || null);
            }}
          >
            <option value="">Выберите фон</option>
            {backdrops.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
            <option value="">Выберите паттерн</option>
            {patterns.map((p) => (
              <option key={p.name} value={p.name}>{p.name} ({(p.rarityPermille / 10).toFixed(1)}‰)</option>
            ))}
          </select>
        </>
      )}

      <button onClick={copyCell}>Копировать</button>
      <button onClick={pasteCell}>Вставить</button>
      <button onClick={handleSave}>Сохранить</button>
      <button onClick={onClose}>Отмена</button>
    </Modal>
  );
};

const PatternRings = ({ gift, pattern, cellId }) => {
  const svgRef = useRef(null);
  const uniqueId = `pattern-symbol-${cellId}`;

  useEffect(() => {
    if (!svgRef.current || !gift || !pattern) {
      if (svgRef.current) svgRef.current.innerHTML = '';
      return;
    }

    const svg = svgRef.current;
    svg.innerHTML = '';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('id', uniqueId);
    img.setAttribute('href', `${API_BASE}/pattern/${normalizeGiftName(gift)}/${pattern}.png?size=256`);
    img.setAttribute('width', '32');
    img.setAttribute('height', '32');
    defs.appendChild(img);
    svg.appendChild(defs);

    const centerX = 128;
    const centerY = 128;
    const symbolSize = 32;
    const rings = [50, 90, 130, 170];
    const baseAngleStep = 30;

    rings.forEach((radius, ringIndex) => {
      const offset = ringIndex % 2 === 0 ? 0 : baseAngleStep / 2;
      const numSymbols = Math.floor((2 * Math.PI * radius) / (symbolSize * 1.4));
      const angleStep = 360 / numSymbols;

      for (let i = 0; i < numSymbols; i++) {
        const angle = (i * angleStep + offset) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle) - symbolSize / 2;
        const y = centerY + radius * Math.sin(angle) - symbolSize / 2;

        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${uniqueId}`);
        use.setAttribute('x', x);
        use.setAttribute('y', y);
        svg.appendChild(use);
      }
    });
  }, [gift, pattern, uniqueId]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 256 256"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        opacity: 0.18,
      }}
    />
  );
};

const TgsAnimation = ({ gift, model, giftId }) => {
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadAnimation = async () => {
      if (!containerRef.current) return;

      try {
        if (animationRef.current) {
          animationRef.current.destroy();
          animationRef.current = null;
        }

        let cacheKey;
        let tgsUrl;
        
        if (model) {
          // Upgraded gift - use model endpoint
          cacheKey = `model/${gift}/${model}`;
          tgsUrl = `${API_BASE}/model/${normalizeGiftName(gift)}/${model}.tgs`;
        } else if (giftId) {
          // Non-upgraded gift - use original endpoint
          cacheKey = `original/${giftId}`;
          tgsUrl = `${API_BASE}/original/${giftId}.tgs`;
        } else {
          console.warn('[TgsAnimation] Neither model nor giftId provided');
          return;
        }

        console.log('[TgsAnimation] Loading animation:', { gift, model, giftId, tgsUrl });
        
        // Try to get cached animation data first (instant playback)
        let animationData = animationCache.get(cacheKey);
        
        if (!animationData) {
          // Not cached, fetch and cache it
          const response = await fetch(tgsUrl);
          if (!response.ok) throw new Error(`Failed to load animation: ${response.status} ${response.statusText}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
          animationData = JSON.parse(decompressed);
          
          // Cache for future use
          animationCache.set(cacheKey, animationData);
        }

        if (!isMounted || !containerRef.current) return;

        animationRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: animationData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            clearCanvas: true,
            progressiveLoad: true,
            hideOnTransparent: true
          }
        });
      } catch (error) {
        console.error(`[TgsAnimation] Failed to load animation:`, error);
        
        if (isMounted && containerRef.current) {
          containerRef.current.textContent = '';
          
          // Fallback to PNG
          let fallbackUrl;
          if (model) {
            fallbackUrl = `${API_BASE}/model/${normalizeGiftName(gift)}/${model}.png?size=256`;
          } else if (giftId) {
            fallbackUrl = `${API_BASE}/original/${giftId}.png?size=256`;
          }
          
          if (fallbackUrl) {
            const img = document.createElement('img');
            img.src = fallbackUrl;
            img.alt = 'gift';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            containerRef.current.appendChild(img);
          }
        }
      }
    };

    loadAnimation();

    return () => {
      isMounted = false;
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [gift, model, giftId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
      }}
    />
  );
};

export default App;
