import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';
import { Upload, Sparkles, Wand2, Download, RefreshCw, Loader2, Info, Save, History, Shirt, User, User2, AlertTriangle, Grid3X3, CheckCircle, Lightbulb, Palette, FileText, ShoppingBag, X, Printer, IndianRupee, ZoomIn, CheckSquare, Square, ScanEye, Globe, HeartHandshake, Share2, Trash2 } from 'lucide-react';

// ---------------------------------------------------------
// CONFIGURATION & SETUP (Mandatory Global Init Pattern)
// ---------------------------------------------------------

const isCanvas = typeof __firebase_config !== 'undefined';
const firebaseConfig = isCanvas ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Initialize Firebase outside the component
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// PERFECTED APP ID EXTRACTOR:
const rawAppId = typeof __app_id !== 'undefined' ? String(__app_id) : 'default-app-id';
const appId = rawAppId.split('/')[0];

const API_KEY = isCanvas ? "" : "YOUR_GEMINI_API_KEY_HERE";
const API_MODEL_VISION = 'gemini-2.5-flash-preview-09-2025';
const API_MODEL_IMAGE = 'imagen-4.0-generate-001';

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------

const safeStr = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            const delay = Math.pow(2, i) * 1000;
            console.warn(`Request failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const compressBase64Image = (base64Str, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve) => {
        if (!base64Str) return resolve(null);
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => resolve(base64Str);
    });
};

const downloadImage = (base64Url, filename) => {
    const link = document.createElement('a');
    link.href = base64Url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const downloadTextFile = (content, filename) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// ---------------------------------------------------------
// UI SUB-COMPONENTS
// ---------------------------------------------------------

const ZoomableImage = ({ src, alt, priceEstimate }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const imgRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!imgRef.current) return;
        const { left, top, width, height } = imgRef.current.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        setPosition({ x, y });
    };

    return (
        <div
            className="relative w-full h-full overflow-hidden cursor-crosshair group rounded-lg bg-stone-100"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseMove={handleMouseMove}
        >
            <img ref={imgRef} src={src} alt={String(alt || '')} className="w-full h-full object-contain transition-transform duration-200" />
            {isHovered && (
                <div
                    className="absolute inset-0 pointer-events-none rounded-lg"
                    style={{ backgroundImage: `url(${src})`, backgroundPosition: `${position.x}% ${position.y}%`, backgroundSize: '250%', zIndex: 10 }}
                />
            )}
            {!isHovered && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center pointer-events-none backdrop-blur-sm">
                    <ZoomIn size={14} className="mr-1" /> Hover to Zoom
                </div>
            )}
            {priceEstimate && (
                <div className="absolute top-2 right-2 bg-white/95 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center z-20 backdrop-blur-sm border border-green-200">
                    <IndianRupee size={12} className="mr-1"/> Est: {String(priceEstimate || '')}
                </div>
            )}
        </div>
    );
};

const ImagePanel = ({ title, image, isPlaceholder, children, priceEstimate }) => (
    <div className="flex flex-col flex-1 p-5 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200">
        <div className="flex items-center mb-4 text-rose-800">
            {children}
            <h2 className="text-xl font-bold ml-2 font-serif">{String(title || '')}</h2>
        </div>
        <div className="flex-1 w-full bg-stone-50 rounded-xl overflow-hidden border-2 border-dashed border-stone-300 flex items-center justify-center relative min-h-[400px] lg:min-h-[450px]">
            {image ? (
                isPlaceholder ? (
                    <img src={image} alt={String(title || '')} className="max-w-full max-h-full object-contain p-2 animate-in fade-in duration-500" />
                ) : (
                    <div className="w-full h-full relative absolute inset-0">
                        <ZoomableImage src={image} alt={title} priceEstimate={priceEstimate} />
                    </div>
                )
            ) : (
                <div className={`text-stone-400 p-8 text-center transition-opacity duration-300`}>
                    <Upload size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Awaiting Input Data</p>
                </div>
            )}
        </div>
    </div>
);

const DetailItem = ({ label, value }) => (
    <div className="p-3 bg-white rounded-lg shadow-sm border border-stone-100">
        <h3 className="text-sm font-medium text-rose-900 uppercase tracking-wider">{safeStr(label)}</h3>
        <p className="text-lg font-bold text-gray-800 mt-1">
            {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value || 'N/A')}
        </p>
    </div>
);

const GenderSelector = ({ selectedGender, onSelect }) => (
    <div className="mb-6 pb-4 border-b border-stone-200">
        <h3 className="text-lg font-bold text-rose-800 mb-3 flex items-center">
            <User size={20} className="mr-2" /> 1. Select Garment Gender
        </h3>
        <div className="flex space-x-4">
            <button onClick={() => onSelect('Male')} className={`flex-1 p-3 rounded-xl font-semibold border-2 ${selectedGender === 'Male' ? 'bg-rose-700 text-white border-rose-700 shadow-md' : 'bg-white text-rose-800 border-stone-200 hover:border-rose-300 transition-colors'}`}>Male</button>
            <button onClick={() => onSelect('Female')} className={`flex-1 p-3 rounded-xl font-semibold border-2 ${selectedGender === 'Female' ? 'bg-rose-700 text-white border-rose-700 shadow-md' : 'bg-white text-rose-800 border-stone-200 hover:border-rose-300 transition-colors'}`}>Female</button>
        </div>
    </div>
);

const VariationSelector = ({ variations, selectedIndex, onSelect, selectedIndices, onToggleSelection }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 mb-6">
         <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-bold text-rose-800 flex items-center">
                <Grid3X3 size={18} className="mr-2" /> Select Design Density
            </h3>
            {selectedIndices.size > 0 && <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-full">{selectedIndices.size} selected</span>}
         </div>
        <div className="flex space-x-3 overflow-x-auto pb-2">
            {variations.map((v, idx) => {
                const isChecked = selectedIndices.has(idx);
                return (
                    <div key={idx} className="relative group flex-shrink-0">
                        <button
                            onClick={() => onSelect(idx)}
                            className={`flex flex-col items-center space-y-2 p-2 rounded-lg border-2 transition-all duration-200 ${selectedIndex === idx ? 'border-rose-700 bg-rose-50 scale-105' : 'border-gray-200 hover:border-rose-200'}`}
                        >
                            <img src={v.url} alt={String(v.label || '')} className="w-20 h-20 object-cover rounded-md shadow-sm" />
                            <span className={`text-sm font-medium ${selectedIndex === idx ? 'text-rose-800' : 'text-gray-600'}`}>
                                {String(v.label || '')}
                            </span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleSelection(idx); }}
                            className="absolute top-1 right-1 p-1 bg-white/90 rounded-bl-lg hover:bg-white text-rose-700 transition-colors shadow-sm"
                            title={isChecked ? "Deselect" : "Select for download/saving"}
                        >
                            {isChecked ? <CheckSquare size={18} fill="currentColor" className="text-rose-700" /> : <Square size={18} className="text-gray-400 hover:text-rose-500" />}
                        </button>
                    </div>
                );
            })}
        </div>
    </div>
);

const RecommendationSection = ({ recommendations, selectedRec, onSelect }) => (
    <div className="mb-8">
        <h3 className="text-xl font-bold text-rose-900 mb-4 flex items-center">
            <Lightbulb size={24} className="mr-2 text-yellow-600" />
            AI Motif Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.map((rec, index) => {
                const isSelected = selectedRec?.name === rec.name;
                const cardImageUrl = `https://placehold.co/600x400/fff1f2/be123c?text=${encodeURIComponent(String(rec.name || ''))}`;
               
                return (
                    <div
                        key={index}
                        onClick={() => onSelect(rec)}
                        className={`rounded-xl border transition-all duration-300 relative overflow-hidden group flex flex-col shadow-sm hover:shadow-md cursor-pointer
                            ${isSelected ? 'border-rose-700 ring-2 ring-rose-200' : 'border-gray-200 bg-white hover:border-rose-300'}`}
                    >
                        <div className="h-40 w-full overflow-hidden relative bg-rose-50">
                            <img src={cardImageUrl} alt={String(rec.name || '')} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            {isSelected && <div className="absolute top-2 right-2 bg-white text-rose-700 rounded-full p-1 shadow-md"><CheckCircle size={20} fill="currentColor" className="text-rose-700" /></div>}
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                            <h4 className="font-bold text-lg text-rose-800 mb-2 leading-tight">{String(rec.name || '')}</h4>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed flex-1">{String(rec.suitability || '')}</p>
                            <button className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${isSelected ? 'bg-rose-700 text-white shadow-md' : 'bg-gray-100 text-gray-600 group-hover:bg-rose-50 group-hover:text-rose-800'}`}>
                                {isSelected ? 'Selected' : 'Click to Apply'}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const CustomizationPanel = ({ threadColor, setThreadColor, fabricColor, setFabricColor, placement, setPlacement }) => (
    <div className="bg-stone-50 p-5 rounded-xl shadow-inner border border-stone-200 mb-6 animate-in fade-in">
        <h3 className="text-lg font-bold text-rose-900 mb-4 flex items-center">
            <Palette size={20} className="mr-2" /> Customization Studio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Thread/Material Color</label>
                <div className="flex flex-wrap gap-2">
                    {['White', 'Gold', 'Silver', 'Black', 'Red', 'Multi'].map(c => <button key={c} onClick={() => setThreadColor(c)} className={`px-3 py-1 text-xs rounded-full border ${threadColor === c ? 'bg-rose-700 text-white border-rose-700 font-bold shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300 transition-colors'}`}>{c}</button>)}
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fabric Dye (Base Color)</label>
                <div className="flex flex-wrap gap-2">
                    {['Original', 'Emerald', 'Navy', 'Maroon', 'Black', 'Pastel Pink', 'Deep Purple'].map(c => <button key={c} onClick={() => setFabricColor(c)} className={`px-3 py-1 text-xs rounded-full border ${fabricColor === c ? 'bg-rose-700 text-white border-rose-700 font-bold shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300 transition-colors'}`}>{c}</button>)}
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Placement</label>
                <div className="flex flex-wrap gap-2">
                    {['Full Body', 'Neckline', 'Daman', 'Sleeves', 'Borders'].map(p => <button key={p} onClick={() => setPlacement(p)} className={`px-3 py-1 text-xs rounded-full border ${placement === p ? 'bg-rose-700 text-white border-rose-700 font-bold shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300 transition-colors'}`}>{p}</button>)}
                </div>
            </div>
        </div>
    </div>
);

const TechPackModal = ({ content, onClose, onDownload }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="bg-rose-900 p-4 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold flex items-center"><FileText className="mr-2" /> Artisan Tech Pack</h3>
                <button onClick={onClose} className="hover:bg-rose-800 p-1 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-sm bg-stone-50">
                <pre className="whitespace-pre-wrap text-stone-800 leading-relaxed">{String(content || '')}</pre>
            </div>
            <div className="p-4 border-t border-stone-200 bg-white flex justify-end space-x-3">
                <button onClick={() => window.print()} className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 font-medium transition-colors"><Printer size={18} className="mr-2" /> Print</button>
                <button onClick={onDownload} className="flex items-center px-4 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 font-bold shadow-sm transition-colors"><Download size={18} className="mr-2" /> Download .TXT</button>
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------
// MAIN APP COMPONENT
// ---------------------------------------------------------

export default function App() {
    const [activeTab, setActiveTab] = useState('studio');
   
    // Auth Guard States
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Studio State
    const [selectedGender, setSelectedGender] = useState(null);
    const [embroideryStyle, setEmbroideryStyle] = useState('Chikankari');
    const [originalImage, setOriginalImage] = useState(null);
    const [originalImageMimeType, setOriginalImageMimeType] = useState(null);
    const [patternImage, setPatternImage] = useState(null);
    const [patternImageMimeType, setPatternImageMimeType] = useState(null);
    const [patternDescription, setPatternDescription] = useState(null);
    const [isPatternAnalyzing, setIsPatternAnalyzing] = useState(false);

    const [threadColor, setThreadColor] = useState('White');
    const [fabricColor, setFabricColor] = useState('Original');
    const [placement, setPlacement] = useState('Full Body');

    const [variations, setVariations] = useState([]);
    const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
    const [selectedIndices, setSelectedIndices] = useState(new Set());

    const [recommendations, setRecommendations] = useState([]);
    const [selectedRecommendation, setSelectedRecommendation] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Select gender and style to begin.');
    const [garmentDetails, setGarmentDetails] = useState(null);
    const [designContext, setDesignContext] = useState(null);
    const [isContextOpen, setIsContextOpen] = useState(false);
    const [isGarmentDetailsOpen, setIsGarmentDetailsOpen] = useState(false);
    const [errorState, setErrorState] = useState(null);
   
    // Save State
    const [autoSave, setAutoSave] = useState(true);
    const [shareToCommunity, setShareToCommunity] = useState(false);
    const [showTechPack, setShowTechPack] = useState(false);

    // Data State
    const [privateDesigns, setPrivateDesigns] = useState([]);
    const [publicDesigns, setPublicDesigns] = useState([]);

    const activeImage = variations.length > 0 ? variations[selectedVariationIndex]?.url : null;
    const activeLabel = variations.length > 0 ? String(variations[selectedVariationIndex]?.label || '') : '';

    // --- Firebase Auth Initialization ---
    useEffect(() => {
        let isMounted = true;
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                console.error("Auth Error", e);
            } finally {
                if (isMounted) setIsAuthReady(true);
            }
        };
       
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (isMounted) setUserId(user ? user.uid : null);
        });
       
        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    // --- Secure Data Listeners (Waits for AuthReady) ---
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        // Private History Listener
        const privateQ = query(collection(db, 'artifacts', appId, 'users', userId, 'savedDesigns'));
        const unsubPrivate = onSnapshot(privateQ,
            (snapshot) => {
                setPrivateDesigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
            },
            (error) => console.error("Private fetch error", error)
        );

        // Public Community Listener
        const publicQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'gallery'));
        const unsubPublic = onSnapshot(publicQ,
            (snapshot) => {
                setPublicDesigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
            },
            (error) => console.error("Public fetch error", error)
        );

        return () => { unsubPrivate(); unsubPublic(); };
    }, [isAuthReady, userId]);

    // --- Price Estimator ---
    const getPriceEstimate = () => {
        if (!activeLabel || !embroideryStyle) return null;
       
        const densityMultiplier = { 'Minimal': 1, 'Light': 1.5, 'Medium': 2.5, 'Heavy': 4, 'Royal': 7 };
        const styleBase = {
            'Chikankari': 2000,
            'Zardosi': 6000,    
            'Phulkari': 1800,    
            'Kantha': 1500,      
            'Gota Patti': 3500  
        };

        const base = (styleBase[embroideryStyle] || 2000) * (densityMultiplier[activeLabel] || 1);
        const fabricMultiplier = garmentDetails?.clothType?.toLowerCase().includes('silk') ? 1.5 : 1;
       
        const min = Math.round(base * fabricMultiplier);
        const max = Math.round(min * 1.3);
        return `₹${min.toLocaleString()} - ₹${max.toLocaleString()}`;
    };

    // --- Delete Function ---
    const handleDeleteDesign = async (designId, e) => {
        if (e) e.stopPropagation();
        if (!userId || !db) return;
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'savedDesigns', designId));
            setStatusMessage("Design removed from history.");
        } catch (error) {
            console.error("Error deleting design:", error);
            setStatusMessage("Failed to delete design.");
        }
    };

    // --- Save & Share ---
    // UPDATED to accept and compress all variations array
    const saveToHistory = async (imgData, label, context, details, originalImg, isPublic = false, varsToSave = []) => {
        if (!userId) return false;
        try {
            const compressedOriginal = originalImg ? await compressBase64Image(originalImg) : null;
            const compressedProcessed = imgData ? await compressBase64Image(imgData) : null;
           
            // Compress all selected variations for the history payload
            const compressedVariations = await Promise.all(varsToSave.map(async (v) => ({
                label: v.label,
                url: await compressBase64Image(v.url)
            })));

            const payload = {
                userId: userId,
                originalImage: compressedOriginal,
                processedImage: compressedProcessed,
                embroideryStyle: safeStr(embroideryStyle),
                designDensity: safeStr(label),
                designContext: context,
                garmentDetails: details,
                customization: { threadColor: safeStr(threadColor), placement: safeStr(placement), fabricColor: safeStr(fabricColor) },
                priceEstimate: safeStr(getPriceEstimate()),
                timestamp: Date.now(),
                variations: compressedVariations // Save all chosen variations array
            };

            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'savedDesigns'), payload);
           
            if (isPublic) {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'gallery'), payload);
            }
            return true;
        } catch (e) {
            console.error("Save failed", e);
            return false;
        }
    };

    const handleManualSave = async () => {
        if (!activeImage) return;
        setStatusMessage("Saving designs...");
       
        // Save selected variations, or ALL variations if none are explicitly selected via checkboxes
        const varsToSave = selectedIndices.size > 0
            ? variations.filter((_, idx) => selectedIndices.has(idx))
            : variations;

        const success = await saveToHistory(activeImage, activeLabel, designContext, garmentDetails, originalImage, shareToCommunity, varsToSave);
        if (success) {
            setStatusMessage(`Saved ${varsToSave.length} design(s) to history${shareToCommunity ? ' & shared' : ''}!`);
        } else {
            setStatusMessage("Error saving designs.");
        }
    };

    // --- Analysis & Generation logic ---
    const analyzeGarment = useCallback(async (base64Image, mimeType, gender) => {
        setIsLoading(true); setGarmentDetails(null); setRecommendations([]); setErrorState(null);
        setStatusMessage(`Analyzing garment structure...`);
        try {
            const visionApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL_VISION}:generateContent?key=${API_KEY}`;
            const structuredAnalysisPrompt = `Analyze the image. Category: "${gender}". 1. Verify valid garment. 2. Identify cloth type, color, style. 3. Check for gender mismatch. 4. Suggest 3 thematic concepts for ethnic embroidery. Return JSON.`;
            const payload = {
                contents: [{ parts: [{ text: structuredAnalysisPrompt }, { inlineData: { mimeType: mimeType, data: base64Image } }] }],
                generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { clothColor: { type: "STRING" }, clothType: { type: "STRING" }, clothTexture: { type: "STRING" }, garmentStyle: { type: "STRING" }, detectedGender: { type: "STRING" }, isValidGarment: { type: "BOOLEAN" }, isGenderMismatch: { type: "BOOLEAN" }, recommendations: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, description: { type: "STRING" }, suitability: { type: "STRING" } } } } } } }
            };
            const response = await fetchWithRetry(visionApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (jsonText) {
                const data = JSON.parse(jsonText);
                if (!data.isValidGarment) {
                    setErrorState("Not a valid garment detected.");
                    setOriginalImage(null);
                    return;
                }
                if (data.isGenderMismatch) {
                    setErrorState(`Gender mismatch warning: Looks like ${data.detectedGender}.`);
                }
                setGarmentDetails(data);
                setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
                setFabricColor(String(data.clothColor || 'Original'));
                setStatusMessage('Analysis complete!');
            }
        } catch (error) {
            console.error(error);
            setStatusMessage('Analysis failed.');
            setErrorState(error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const analyzePattern = async (base64, mimeType) => {
        setIsPatternAnalyzing(true);
        setStatusMessage('Analyzing pattern style...');
        try {
            const visionApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL_VISION}:generateContent?key=${API_KEY}`;
            const prompt = "Analyze this textile pattern image. Describe the exact visual motifs, shapes, and layout in high detail (15-20 words). Focus on exactly what should be embroidered. Return ONLY the description text.";
            const payload = { contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64 } }] }] };
            const response = await fetchWithRetry(visionApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                setPatternDescription(safeStr(text).trim());
                setStatusMessage(`Pattern detected: ${safeStr(text).trim()}`);
            }
        } catch (e) {
            setPatternDescription("custom generic pattern");
            setStatusMessage('Pattern analysis failed, using fallback.');
        } finally {
            setIsPatternAnalyzing(false);
        }
    };

    const generateDesign = useCallback(async () => {
        if (!originalImage || !selectedGender) return;
        setIsLoading(true); setVariations([]); setSelectedIndices(new Set()); setDesignContext(null); setIsContextOpen(false);
       
        const targetColor = fabricColor === 'Original' ? String(garmentDetails?.clothColor || 'fabric') : fabricColor;
        const desc = garmentDetails ? `${String(garmentDetails.garmentStyle || 'garment')} made of ${targetColor} ${String(garmentDetails.clothType || 'fabric')}` : 'garment';
       
        try {
            if (!garmentDetails) { await analyzeGarment(originalImage.split(',')[1], originalImageMimeType, selectedGender); if (!garmentDetails) return; }
           
            setStatusMessage(patternImage ? `Mapping custom pattern directly onto garment...` : `Generating 5 ${embroideryStyle} variations...`);
           
            let basePatternText = selectedRecommendation
                ? String(selectedRecommendation.description || 'motifs')
                : (patternDescription ? patternDescription : `traditional ${embroideryStyle} motifs`);

            const prompts = [
                { l: 'Minimal', d: `sparse outlines, minimal embellishment` },
                { l: 'Light', d: `delicate, airy spacing` },
                { l: 'Medium', d: `balanced standard density` },
                { l: 'Heavy', d: `rich, dense coverage` },
                { l: 'Royal', d: `opulent, extreme detail, full coverage` }
            ];

            const promises = prompts.map(async (p) => {
                const editUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`;
                let promptText = `Image Editing Task: Preserve the original person, background, and garment silhouette completely. Overlay realistic ${embroideryStyle} embroidery onto the clothing. `;
               
                const parts = [];
                if (patternImage) {
                    promptText += `CRITICAL REQUIREMENT: Use the exact visual pattern, motifs, and shapes from the SECOND provided image. Do NOT use standard/generic AI motifs. Map the pattern from the second image directly onto the garment in the first image. `;
                } else {
                    promptText += `Use this motif style: "${basePatternText}". `;
                }
                promptText += `Embroidery Density: ${p.d}. Thread Color: ${threadColor}. Placement: ${placement}. Photorealistic textile texture.`;
               
                parts.push({ text: promptText });
                parts.push({ inlineData: { mimeType: originalImageMimeType || 'image/jpeg', data: originalImage.split(',')[1] } });
               
                if (patternImage) {
                    parts.push({ inlineData: { mimeType: patternImageMimeType || 'image/jpeg', data: patternImage.split(',')[1] } });
                }

                const payload = {
                    contents: [{ role: "user", parts }],
                    generationConfig: { responseModalities: ["IMAGE"] }
                };

                let b64 = null;
                try {
                    const response = await fetchWithRetry(editUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const result = await response.json();
                    b64 = result?.candidates?.[0]?.content?.parts?.find(pt => pt.inlineData)?.inlineData?.data;
                } catch (err) {
                    console.warn("Editing API failed, falling back to Imagen...", err);
                }

                if (!b64) {
                    const fallbackPrompt = `High-fashion photography of a ${selectedGender} wearing a ${desc}. Apply ${p.d} authentic ${embroideryStyle}. Motif: "${basePatternText}". Thread color: ${threadColor}. Placement: ${placement}. Photorealistic texture.`;
                    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;
                    const fallbackResponse = await fetchWithRetry(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt: fallbackPrompt }], parameters: { sampleCount: 1 } }) });
                    const fallbackResult = await fallbackResponse.json();
                    b64 = fallbackResult?.predictions?.[0]?.bytesBase64Encoded;
                }

                return b64 ? { label: p.l, url: `data:image/jpeg;base64,${b64}` } : null;
            });

            const results = await Promise.all(promises);
            const validRes = results.filter(v => v);
           
            if (validRes.length === 0) { setStatusMessage('Generation failed.'); setIsLoading(false); return; }
           
            setVariations(validRes);
            setSelectedVariationIndex(Math.floor(validRes.length / 2));
            setStatusMessage('Creating contextual details...');
           
            const contextUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL_VISION}:generateContent?key=${API_KEY}`;
            const contextPrompt = `Expert fashion styling: ${embroideryStyle} on ${desc}, Motif: "${basePatternText}". Return JSON: {designName (creative), chikanContext (cultural backstory), productTagline}`;
            const cRes = await fetchWithRetry(contextUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: contextPrompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
            const cJson = await cRes.json();
            const cText = cJson?.candidates?.[0]?.content?.parts?.[0]?.text;
           
            if (cText) {
                const ctx = JSON.parse(cText);
                setDesignContext(ctx);
                setIsContextOpen(true);
                if (autoSave && userId) {
                    // Save ALL valid variations on auto-save
                    saveToHistory(validRes[Math.floor(validRes.length/2)].url, validRes[Math.floor(validRes.length/2)].label, ctx, garmentDetails, originalImage, shareToCommunity, validRes);
                }
                setStatusMessage('Design Complete! ✨');
            }
        } catch (e) {
            console.error(e);
            setStatusMessage('Error occurred.');
            setErrorState(e instanceof Error ? e.message : String(e));
        } finally {
            setIsLoading(false);
        }
    }, [originalImage, garmentDetails, fabricColor, threadColor, placement, selectedRecommendation, patternImage, patternDescription, selectedGender, autoSave, userId, embroideryStyle, shareToCommunity, originalImageMimeType, patternImageMimeType, analyzeGarment]);

    const handleGarmentUpload = async (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setVariations([]); setDesignContext(null); setRecommendations([]);
            setOriginalImageMimeType(file.type);
            const b64 = await fileToBase64(file);
            setOriginalImage(`data:${file.type};base64,${b64}`);
            if(selectedGender) await analyzeGarment(b64, file.type, selectedGender);
        }
    };

    const handlePatternUpload = async (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setPatternImageMimeType(file.type);
            setPatternDescription(null);
            const b64 = await fileToBase64(file);
            setPatternImage(`data:${file.type};base64,${b64}`);
            setStatusMessage('Custom pattern uploaded. Analyzing...');
            setSelectedRecommendation(null);
            await analyzePattern(b64, file.type);
        }
    };

    const removePattern = () => {
        setPatternImage(null);
        setPatternImageMimeType(null);
        setPatternDescription(null);
        setStatusMessage('Pattern removed.');
    };

    const handleBulkDownload = () => {
        if (selectedIndices.size === 0) {
            if (activeImage) downloadImage(activeImage, `nazakat-${activeLabel.toLowerCase()}.png`);
            return;
        }
        selectedIndices.forEach((index) => {
            const variant = variations[index];
            if (variant) {
                setTimeout(() => {
                    downloadImage(variant.url, `nazakat-${String(variant.label || 'design').toLowerCase()}.png`);
                }, index * 500);
            }
        });
        setStatusMessage(`Downloading ${selectedIndices.size} selected designs...`);
    };

    const generateTechPackContent = () => {
        if (!designContext || !garmentDetails) return "No design data available.";
        return `
NAZAKAT DESIGNER - ARTISAN TECH PACK
====================================
Date: ${new Date().toLocaleDateString()}
Design Name: ${safeStr(designContext.designName || '')}
Style Category: ${safeStr(garmentDetails.garmentStyle || '')} (${safeStr(selectedGender || '')})
Base Fabric: ${safeStr(garmentDetails.clothType || '')} | Base Color: ${fabricColor === 'Original' ? safeStr(garmentDetails.clothColor || '') : safeStr(fabricColor || '')}
====================================
EMBROIDERY SPECIFICATIONS
Technique: ${safeStr(embroideryStyle || '')}
Thread/Material Color: ${safeStr(threadColor || '')}
Density Level: ${safeStr(activeLabel || '')}
Placement Focus: ${safeStr(placement || '')}
Motif Source: ${patternImage ? (patternDescription || 'Custom Upload') : 'AI Recommended Tradition'}
====================================
MARKETING NOTES
Tagline: "${safeStr(designContext.productTagline || '')}"
Cultural Context: ${safeStr(designContext.chikanContext || '')}
        `;
    };

    // --- RENDER HELPERS ---
    const renderGalleryGrid = (items, isPublic = false) => {
        if (items.length === 0) return <div className="text-center py-12 text-gray-400">No designs found here yet.</div>;
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {items.map(d => (
                    <div key={d.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-stone-200 group transition-all hover:-translate-y-1 hover:shadow-xl">
                        <div className="h-48 bg-gray-100 relative overflow-hidden">
                            <img src={d.processedImage} className="w-full h-full object-cover transition-transform group-hover:scale-105"/>
                            <div className="absolute top-2 right-2 bg-stone-800 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">{safeStr(d.embroideryStyle || '')}</div>
                            <div className="absolute bottom-0 right-0 bg-rose-700 text-white text-xs px-3 py-1 rounded-tl-xl">{safeStr(d.designDensity || '')}</div>
                           
                            {/* DELETE BUTTON ADDED FOR PRIVATE HISTORY */}
                            {!isPublic && (
                                <button
                                    onClick={(e) => handleDeleteDesign(d.id, e)}
                                    className="absolute top-2 left-2 bg-white/90 p-1.5 rounded-full shadow-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors z-10"
                                    title="Delete Design"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        <div className="p-4 flex flex-col justify-between h-[120px]">
                            <div>
                                <h4 className="font-bold text-sm text-rose-900 line-clamp-1" title={safeStr(d.designContext?.designName || '')}>{safeStr(d.designContext?.designName || "Untitled Design")}</h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{safeStr(d.designContext?.productTagline || '')}</p>
                            </div>
                            {!isPublic && (
                                <button onClick={() => {
                                    setActiveTab('studio');
                                    setOriginalImage(d.originalImage);
                                    setEmbroideryStyle(d.embroideryStyle || 'Chikankari');
                                   
                                    // LOAD FULL BATCH OF VARIATIONS IF AVAILABLE
                                    if (d.variations && d.variations.length > 0) {
                                        setVariations(d.variations);
                                    } else {
                                        // Fallback for older saves
                                        setVariations([{label:d.designDensity, url:d.processedImage}]);
                                    }
                                   
                                    setSelectedVariationIndex(0);
                                    setSelectedIndices(new Set()); // Reset selections
                                    setDesignContext(d.designContext);
                                    setGarmentDetails(d.garmentDetails);
                                    window.scrollTo({ top: 0, behavior: 'smooth' }); // Smooth scroll to top
                                }} className="mt-2 w-full text-xs font-semibold bg-stone-50 text-rose-800 py-2 rounded-lg hover:bg-stone-100 transition-colors">
                                    Load into Studio
                                </button>
                            )}
                            {isPublic && (
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                                    <span className="flex items-center"><User2 size={12} className="mr-1"/> Designer</span>
                                    <span>{d.timestamp ? new Date(d.timestamp).toLocaleDateString() : 'Just now'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-stone-50 font-sans text-stone-900 selection:bg-rose-100 selection:text-rose-900 flex flex-col">
           
            {/* Header / Nav */}
            <header className="bg-white text-gray-900 sticky top-0 z-40 shadow-sm border-b border-stone-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
                        <div className="flex items-center">
                            <Sparkles className="w-8 h-8 mr-3 text-rose-600" />
                            <div>
                                <h1 className="text-2xl font-serif font-bold tracking-wide text-rose-900">Nazakat Designer</h1>
                            </div>
                        </div>
                       
                        <nav className="flex bg-stone-100 p-1 rounded-xl">
                            <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === 'studio' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-rose-700 hover:bg-stone-200'}`}>
                                <Palette size={16} className="mr-2"/> Studio
                            </button>
                            <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === 'history' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-rose-700 hover:bg-stone-200'}`}>
                                <History size={16} className="mr-2"/> My History
                            </button>
                            <button onClick={() => setActiveTab('community')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeTab === 'community' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-rose-700 hover:bg-stone-200'}`}>
                                <Globe size={16} className="mr-2"/> Community
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
               
                {/* STUDIO TAB */}
                {activeTab === 'studio' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                       
                        {/* Control Panel */}
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-stone-200">
                           
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 border-b border-stone-100 pb-6">
                                {/* Step 1 & 2 */}
                                <div className="space-y-6">
                                    <GenderSelector selectedGender={selectedGender} onSelect={(g) => {setSelectedGender(g); setStatusMessage(`Selected ${g}. Select Style next.`);}} />
                                   
                                    <div>
                                        <h3 className="text-lg font-bold text-rose-800 mb-3 flex items-center"><Sparkles size={20} className="mr-2 text-rose-600" /> 2. Embroidery Technique</h3>
                                        <select
                                            value={embroideryStyle}
                                            onChange={(e) => setEmbroideryStyle(e.target.value)}
                                            className="w-full p-3 rounded-xl border-2 border-stone-200 bg-stone-50 text-rose-900 font-semibold focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none transition-all cursor-pointer"
                                        >
                                            <option value="Chikankari">Chikankari (White Thread Shadow Work)</option>
                                            <option value="Zardosi">Zardosi (Metallic Wire & Sequin)</option>
                                            <option value="Phulkari">Phulkari (Vibrant Geometric Silk)</option>
                                            <option value="Kantha">Kantha (Intricate Running Stitch)</option>
                                            <option value="Gota Patti">Gota Patti (Gold/Silver Appliqué)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Step 3 & 4 */}
                                <div className="space-y-6 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                    <div>
                                        <label className="font-bold text-rose-800 flex items-center mb-2">3. Upload Base Garment</label>
                                        <input type="file" accept="image/*" onChange={handleGarmentUpload} disabled={!selectedGender} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-stone-100 file:text-rose-800 hover:file:bg-stone-200 cursor-pointer"/>
                                        {errorState && <p className="text-red-500 text-xs mt-2 bg-red-50 p-2 rounded">{String(errorState)}</p>}
                                    </div>

                                    <div>
                                        <label className="font-bold text-rose-800 flex items-center mb-2">4. Motif/Pattern Inspiration <span className="text-xs font-normal text-gray-500 ml-2">(Optional)</span></label>
                                        <div className="flex items-start space-x-3">
                                            <div className="flex-1 relative">
                                                <input type="file" accept="image/*" onChange={handlePatternUpload} disabled={!selectedGender} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-stone-100 file:text-rose-800 hover:file:bg-stone-200 cursor-pointer"/>
                                                {isPatternAnalyzing && <div className="absolute right-3 top-3"><Loader2 size={16} className="animate-spin text-rose-600" /></div>}
                                                {patternDescription && (
                                                    <div className="mt-2 text-xs bg-rose-50 text-rose-800 p-2 rounded-lg border border-rose-100 flex items-center">
                                                        <ScanEye size={12} className="mr-2 flex-shrink-0 text-rose-600" />
                                                        <span className="font-medium truncate">AI Motif: {String(patternDescription)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {patternImage && (
                                                <div className="relative flex-shrink-0">
                                                    <img src={patternImage} alt="Pattern" className="w-12 h-12 object-cover rounded-lg border border-stone-200 shadow-sm" />
                                                    <button onClick={removePattern} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow border border-red-100 text-red-500 hover:text-red-700 hover:bg-red-50"><X size={12} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                           
                            {originalImage && (
                                <CustomizationPanel threadColor={threadColor} setThreadColor={setThreadColor} fabricColor={fabricColor} setFabricColor={setFabricColor} placement={placement} setPlacement={setPlacement} />
                            )}

                            {/* Action Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                <div className="flex items-center space-x-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="mr-2 w-4 h-4 text-rose-700 rounded border-stone-300 accent-rose-700"/>
                                        <span className="text-sm font-semibold text-rose-800">Auto-save</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer text-rose-800" title="Share generated designs to the public gallery">
                                        <input type="checkbox" checked={shareToCommunity} onChange={(e) => setShareToCommunity(e.target.checked)} className="mr-2 w-4 h-4 text-blue-500 rounded border-stone-300 accent-blue-500"/>
                                        <Globe size={14} className="mr-1 text-blue-600"/>
                                        <span className="text-sm font-semibold">Share to Gallery</span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <span className="text-xs text-gray-500 font-medium hidden md:block">{String(statusMessage)}</span>
                                    {activeImage && (
                                        <button onClick={handleManualSave} disabled={!userId} className="px-4 py-2.5 bg-blue-500 text-white border-none rounded-xl font-bold hover:bg-blue-600 flex items-center shadow-sm transition-all">
                                            <Save size={18} className="mr-2" />
                                            {selectedIndices.size > 0 ? `Save ${selectedIndices.size} Selected` : 'Save All'}
                                        </button>
                                    )}
                                    <button onClick={generateDesign} disabled={!originalImage || isLoading} className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-700 text-white rounded-xl font-bold hover:bg-rose-800 flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
                                        {isLoading ? 'Crafting...' : 'Generate Design'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Feedback */}
                        {garmentDetails && (
                            <div className="bg-white p-1 rounded-2xl shadow-md border border-stone-200">
                                <button onClick={() => setIsGarmentDetailsOpen(!isGarmentDetailsOpen)} className="w-full text-left py-3 px-5 flex items-center justify-between text-rose-800 font-serif font-bold text-lg hover:bg-stone-50 rounded-xl transition duration-150">
                                    <span className="flex items-center"><Shirt size={20} className="mr-3 text-rose-700" /> Detected Style: {String(garmentDetails.garmentStyle || '')}</span>
                                    <span>{isGarmentDetailsOpen ? '▼' : '▶'}</span>
                                </button>
                                {isGarmentDetailsOpen && (
                                    <div className="p-5 border-t border-stone-200 bg-stone-50 rounded-b-xl grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <DetailItem label="Base Color" value={garmentDetails.clothColor} />
                                        <DetailItem label="Fabric Type" value={garmentDetails.clothType} />
                                        <DetailItem label="Texture" value={garmentDetails.clothTexture} />
                                        <DetailItem label="Style/Fit" value={garmentDetails.garmentStyle} />
                                    </div>
                                )}
                            </div>
                        )}

                        {recommendations.length > 0 && <RecommendationSection recommendations={recommendations} selectedRec={selectedRecommendation} onSelect={(r) => { setSelectedRecommendation(r); setPatternImage(null); setStatusMessage(`Motif Selected: ${r.name}`); }} />}

                        {/* FORCED 50/50 GRID FOR IMAGE PANELS */}
                        <div className="grid grid-cols-2 gap-6 w-full">
                            <ImagePanel title="Original Garment" image={originalImage} isPlaceholder={!originalImage}><RefreshCw size={20} className="mr-2 opacity-50" /></ImagePanel>
                            <ImagePanel title={`Digital Artisan (${activeLabel})`} image={activeImage} isPlaceholder={!activeImage} priceEstimate={getPriceEstimate()}><Sparkles size={20} className="mr-2 text-rose-600" /></ImagePanel>
                        </div>
                       
                        {/* Variations & Context */}
                        {variations.length > 0 && (
                            <VariationSelector
                                variations={variations}
                                selectedIndex={selectedVariationIndex}
                                onSelect={setSelectedVariationIndex}
                                selectedIndices={selectedIndices}
                                onToggleSelection={(idx) => setSelectedIndices(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })}
                            />
                        )}

                        {designContext && (
                            <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-xl text-gray-900 relative overflow-hidden">
                                <Sparkles className="absolute top-4 right-4 text-rose-100 w-32 h-32" />
                                <h3 className="text-2xl font-serif font-bold mb-2 flex items-center text-rose-800">
                                    {String(designContext.designName || '')}
                                </h3>
                                <p className="text-sm font-medium tracking-widest uppercase mb-4 text-rose-600">{String(designContext.productTagline || '')}</p>
                                <p className="text-gray-700 italic leading-relaxed max-w-3xl mb-6 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                    "{String(designContext.chikanContext || '')}"
                                </p>
                                <div className="flex flex-wrap gap-4 relative z-10">
                                    <button onClick={() => setShowTechPack(true)} className="flex items-center px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl transition font-semibold"><FileText size={18} className="mr-2" /> View Tech Pack</button>
                                    <button onClick={() => alert("Connecting to artisan network...")} className="flex items-center px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-bold shadow-md"><ShoppingBag size={18} className="mr-2" /> Request Quote</button>
                                    <button onClick={() => {if(selectedIndices.size>0 || activeImage){handleBulkDownload()}}} className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-semibold ml-auto shadow-md"><Download size={18} className="mr-2" /> Download Assets</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-stone-200">
                            <div>
                                <h2 className="text-3xl font-serif font-bold text-rose-900">My Design History</h2>
                                <p className="text-gray-500 mt-1">Private collection of your generated concepts.</p>
                            </div>
                            <div className="bg-rose-100 text-rose-800 px-4 py-2 rounded-xl font-bold flex items-center">
                                <History className="mr-2 w-5 h-5"/> {privateDesigns.length} Designs
                            </div>
                        </div>
                        {renderGalleryGrid(privateDesigns, false)}
                    </div>
                )}

                {/* COMMUNITY TAB */}
                {activeTab === 'community' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-stone-200">
                            <div>
                                <h2 className="text-3xl font-serif font-bold text-rose-900">Community Gallery</h2>
                                <p className="text-gray-500 mt-1">Explore and get inspired by designs shared by fellow creators.</p>
                            </div>
                            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-xl font-bold flex items-center">
                                <Globe className="mr-2 w-5 h-5"/> {publicDesigns.length} Public Designs
                            </div>
                        </div>
                        {renderGalleryGrid(publicDesigns, true)}
                    </div>
                )}

            </main>
           
            {showTechPack && <TechPackModal content={generateTechPackContent()} onClose={() => setShowTechPack(false)} onDownload={() => downloadTextFile(generateTechPackContent(), 'Nazakat_TechPack.txt')} />}
        </div>
    );
}