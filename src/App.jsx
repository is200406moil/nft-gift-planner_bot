// App.js - Main component for NFT Gift Planner
import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import './App.css'; // Assume CSS file for styles
import Modal from 'react-modal'; // For modals, install react-modal
import html2canvas from 'html2canvas'; // For export, install html2canvas
import lottie from 'lottie-web';
import pako from 'pako';

Modal.setAppElement('#root');

const API_BASE = 'https://api.changes.tg';

const fallbackGifts = ['Santa Hat', 'Signet Ring', 'Precious Peach', 'Plush Pepe', 'Spiced Wine', 'Jelly Bunny', 'Durov\'s Cap', 'Perfume Bottle', 'Eternal Rose', 'Berry Box', 'Vintage Cigar', 'Magic Potion', 'Kissed Frog', 'Hex Pot', 'Evil Eye', 'Sharp Tongue', 'Trapped Heart', 'Skull Flower', 'Scared Cat', 'Spy Agaric', 'Homemade Cake', 'Genie Lamp', 'Lunar Snake', 'Party Sparkler', 'Jester Hat', 'Witch Hat', 'Hanging Star', 'Love Candle', 'Cookie Heart', 'Desk Calendar', 'Jingle Bells', 'Snow Mittens', 'Voodoo Doll', 'Mad Pumpkin', 'Hypno Lollipop', 'B-Day Candle', 'Bunny Muffin', 'Astral Shard', 'Flying Broom', 'Crystal Ball', 'Eternal Candle', 'Swiss Watch', 'Ginger Cookie', 'Mini Oscar', 'Lol Pop', 'Ion Gem', 'Star Notepad', 'Loot Bag', 'Love Potion', 'Toy Bear', 'Diamond Ring', 'Sakura Flower', 'Sleigh Bell', 'Top Hat', 'Record Player', 'Winter Wreath', 'Snow Globe', 'Electric Skull', 'Tama Gadget', 'Candy Cane', 'Neko Helmet', 'Jack-in-the-Box', 'Easter Egg', 'Bonded Ring', 'Pet Snake', 'Snake Box', 'Xmas Stocking', 'Big Year', 'Holiday Drink', 'Gem Signet', 'Light Sword', 'Restless Jar', 'Nail Bracelet', 'Heroic Helmet', 'Bow Tie', 'Heart Locket', 'Lush Bouquet', 'Whip Cupcake', 'Joyful Bundle', 'Cupid Charm', 'Valentine Box', 'Snoop Dogg', 'Swag Bag', 'Snoop Cigar', 'Low Rider', 'Westside Sign', 'Stellar Rocket', 'Jolly Chimp', 'Moon Pendant', 'Ionic Dryer', 'Input Key', 'Mighty Arm', 'Artisan Brick', 'Clover Pin', 'Sky Stilettos', 'Fresh Socks', 'Happy Brownie', 'Ice Cream', 'Spring Basket', 'Instant Ramen', 'Faith Amulet', 'Mousse Cake', 'Bling Binky', 'Money Pot', 'Pretty Posy', 'Khabib\'s Papakha', 'UFC Strike', 'Victory Medal'];<grok-card data-id="e72d27" data-type="citation_card" data-plain-type="render_inline_citation" ></grok-card>


function normalizeGiftName(name) {
  return name.toLowerCase().replace(/ /g, '-');
}

function App() {
  const [rows, setRows] = useState(3); // Start with 3 rows
  const [grid, setGrid] = useState(Array.from({ length: 3 }, () => Array(3).fill(null))); // null for empty cells
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState([]);
  const [backdrops, setBackdrops] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState({ row: -1, col: -1 });
  const [copiedCell, setCopiedCell] = useState(null);
  const [modelsCache, setModelsCache] = useState({});
  const [patternsCache, setPatternsCache] = useState({});
  const [animationMode, setAnimationMode] = useState(false);
  const [playingAnimations, setPlayingAnimations] = useState({});

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    try {
      const giftsData = await safeFetch('/gifts', fallbackGifts);
      setGifts(giftsData);
      sessionStorage.setItem('gifts', JSON.stringify(giftsData));

      const backdropsData = await safeFetch('/backdrops', []); // General backdrops
      setBackdrops(backdropsData);
      sessionStorage.setItem('backdrops', JSON.stringify(backdropsData));

      // Pre-fetch models for first 5 gifts
      for (let i = 0; i < 5 && i < giftsData.length; i++) {
        const gift = giftsData[i];
        const norm = normalizeGiftName(gift);
        const models = await safeFetch(`/models/${norm}?sorted`, []);
        setModelsCache((prev) => ({ ...prev, [gift]: models }));
        sessionStorage.setItem(`models_${gift}`, JSON.stringify(models));

        const patterns = await safeFetch(`/patterns/${norm}?sorted`, []);
        setPatternsCache((prev) => ({ ...prev, [gift]: patterns }));
        sessionStorage.setItem(`patterns_${gift}`, JSON.stringify(patterns));
      }

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
            'Connection': 'close',          // ← отключает QUIC/HTTP3
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
      return name;
    }
    return null;
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceRow = Math.floor(source.index / 3);
    const sourceCol = source.index % 3;
    const destRow = Math.floor(destination.index / 3);
    const destCol = destination.index % 3;

    // Create a deep copy of the grid to avoid mutation issues
    const newGrid = grid.map(row => [...row]);
    const temp = newGrid[destRow][destCol];
    newGrid[destRow][destCol] = newGrid[sourceRow][sourceCol];
    newGrid[sourceRow][sourceCol] = temp;
    setGrid(newGrid);
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
    // Find all cells with gifts and models
    const animations = {};
    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && cell.gift && cell.model) {
          const key = `${rowIndex}-${colIndex}`;
          animations[key] = true;
        }
      });
    });
    
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

  if (loading) {
    return <div className="splash">Loading...</div>; // Add animation in CSS
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
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="grid" direction="horizontal" type="cell">
          {(provided) => (
            <div id="grid" className="grid" {...provided.droppableProps} ref={provided.innerRef}>
              {grid.map((row, rowIndex) => (
                <div key={rowIndex} className="row">
                  {row.map((cell, colIndex) => {
                    const index = rowIndex * 3 + colIndex;
                    const isPlaying = playingAnimations[`${rowIndex}-${colIndex}`];
                    return (
                      <Draggable key={index} draggableId={`cell-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            className={`cell ${snapshot.isDragging ? 'dragging' : ''}`}
                            onClick={() => !cell && openModal(rowIndex, colIndex)}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
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
                                  <PatternRings gift={cell.gift} pattern={cell.pattern} />
                                )}
                                {cell?.gift && cell?.model && (
                                  <>
                                    {isPlaying && animationMode ? (
                                      <TgsAnimation 
                                        gift={cell.gift} 
                                        model={cell.model}
                                      />
                                    ) : (
                                      <img
                                        src={`${API_BASE}/model/${normalizeGiftName(cell.gift)}/${cell.model}.png?size=64`}
                                        alt="gift model"
                                        style={{
                                          position: 'absolute',
                                          inset: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'contain',
                                          zIndex: 2,
                                        }}
                                      />
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="empty-cell">Empty</span>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

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
  copiedCell,
  setCopiedCell,
  initialData,
}) => {
  const [link, setLink] = useState('');
  const [gift, setGift] = useState(initialData?.gift || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [backdrop, setBackdrop] = useState(initialData?.backdrop || null);
  const [pattern, setPattern] = useState(initialData?.pattern || '');
  const [models, setModels] = useState([]);
  const [patterns, setPatterns] = useState([]);

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

  useEffect(() => {
    if (gift) {
      // При смене подарка сбрасываем всё зависимое
      setModel('');
      setPattern('');
      setBackdrop(null);
  
      // Сбрасываем локальные списки (если они есть)
      setModels([]);
      setPatterns([]);
  
      // Загружаем новые списки для текущего gift
      loadModelsAndPatterns(gift); // твоя существующая функция
  
      // Если хочешь — можно сбросить и backdrops здесь, но обычно они общие
    } else {
      // Если подарок очищен — тоже сбрасываем
      setModel('');
      setPattern('');
      setBackdrop(null);
      setModels([]);
      setPatterns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gift]);

  const handleLink = () => {
    const parsed = parseLink(link);
    if (parsed) {
      setGift(parsed);
    }
  };

  const copyCell = () => {
    setCopiedCell({ gift, model, backdrop, pattern });
  };

  const pasteCell = () => {
    if (copiedCell) {
      setGift(copiedCell.gift);
      setModel(copiedCell.model);
      setBackdrop(copiedCell.backdrop);
      setPattern(copiedCell.pattern);
    }
  };

  const handleSave = () => {
    onSave({ gift, model, backdrop, pattern });
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose}>
      <h2>Настройка ячейки</h2>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="t.me/nft/Name-123" />
      <button onClick={handleLink}>Распознать ссылку</button>

      <select value={gift} onChange={(e) => {
        setModel('');
        setPattern('');
        setBackdrop(null);
        setModels([]);
        setPatterns([]);
        setGift(e.target.value);  // после сброса устанавливаем новый gift
      }}>
        <option value="">Выберите подарок</option>
        {gifts.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      {gift && (
        <>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
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
                {b.name} {b.hex?.centerColor ? `(${b.hex.centerColor})` : ''}
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

const PatternRings = ({ gift, pattern }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !gift || !pattern) {
      if (svgRef.current) svgRef.current.innerHTML = '';  // очистка если нет паттерна
      return;
    }

    const svg = svgRef.current;
    svg.innerHTML = ''; // очищаем предыдущие символы

    // Определяем <defs> если нужно (можно вынести выше)
    if (!svg.querySelector('#pattern-symbol')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('id', 'pattern-symbol');
      img.setAttribute('href', `${API_BASE}/pattern/${normalizeGiftName(gift)}/${pattern}.png?size=64`);
      img.setAttribute('width', '32');
      img.setAttribute('height', '32');
      defs.appendChild(img);
      svg.appendChild(defs);
    }

    const centerX = 128;
    const centerY = 128;
    const symbolSize = 32;
    const rings = [50, 90, 130, 170]; // радиусы колец — регулируй расстояния
    const baseAngleStep = 30;          // базовый шаг угла — чем меньше, тем плотнее

    rings.forEach((radius, ringIndex) => {
      // Шахматный сдвиг: на чётных кольцах смещаем на половину шага
      const offset = ringIndex % 2 === 0 ? 0 : baseAngleStep / 2;

      // Количество символов на кольце — больше на внешних
      const numSymbols = Math.floor((2 * Math.PI * radius) / (symbolSize * 1.4)); // расстояние между символами ~1.4×размер
      const angleStep = 360 / numSymbols;

      for (let i = 0; i < numSymbols; i++) {
        const angle = (i * angleStep + offset) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle) - symbolSize / 2;
        const y = centerY + radius * Math.sin(angle) - symbolSize / 2;

        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#pattern-symbol');
        use.setAttribute('x', x);
        use.setAttribute('y', y);
        svg.appendChild(use);
      }
    });
  }, [gift, pattern]);

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
        opacity: 0.18, // общая прозрачность колец
      }}
    />
  );
};

const TgsAnimation = ({ gift, model }) => {
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadAnimation = async () => {
      if (!containerRef.current) return;

      try {
        // Clean up previous animation if exists
        if (animationRef.current) {
          animationRef.current.destroy();
          animationRef.current = null;
        }

        // Load TGS format from API (default format, gzipped Lottie JSON)
        const tgsUrl = `${API_BASE}/model/${normalizeGiftName(gift)}/${model}.tgs`;
        
        const response = await fetch(tgsUrl);
        if (!response.ok) throw new Error(`Failed to load animation: ${response.status} ${response.statusText}`);
        
        // Get the TGS file as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        
        // Decompress the gzipped data
        const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
        
        // Parse the decompressed JSON
        const animationData = JSON.parse(decompressed);

        if (!isMounted || !containerRef.current) return;

        // Create lottie animation
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
        console.error(`Failed to load animation for ${gift}/${model}:`, error);
        
        // Fallback to static image if animation fails
        if (isMounted && containerRef.current) {
          // Clear container safely
          containerRef.current.textContent = '';
          
          // Create img element safely to avoid XSS
          const img = document.createElement('img');
          img.src = `${API_BASE}/model/${normalizeGiftName(gift)}/${model}.png?size=64`;
          img.alt = 'gift model';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          containerRef.current.appendChild(img);
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
  }, [gift, model]);

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