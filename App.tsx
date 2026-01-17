
import React, { useState, useEffect } from 'react';
import { FileType, ProcessingFile } from './types';
import { pdfToImages, docxToHtmlAndImages, downloadAsWord, fileToDataUrl } from './utils/converters';
import { convertToLatexHtml } from './services/gemini';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<ProcessingFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(false);

  useEffect(() => {
    const checkKeyStatus = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKeyStatus();
    const timer = setInterval(checkKeyStatus, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleSetupKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } catch (e) {
        console.error("Error opening key selector:", e);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type as FileType;
    setCurrentFile({ file, type, status: 'idle', progress: 0 });
  };

  const processFile = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    setCurrentFile(prev => prev ? { ...prev, status: 'processing', progress: 10 } : null);

    try {
      let images: string[] = [];
      let textData = "";

      if (currentFile.type === FileType.PDF) {
        images = await pdfToImages(currentFile.file);
        textData = "[PDF]";
      } else if (currentFile.type === FileType.DOCX) {
        const res = await docxToHtmlAndImages(currentFile.file);
        const div = document.createElement('div');
        div.innerHTML = res.html;
        textData = div.innerText;
        images = res.images.slice(0, 10);
      } else if (
        currentFile.type === FileType.PNG || 
        currentFile.type === FileType.JPEG || 
        currentFile.type === FileType.JPG
      ) {
        const imgUrl = await fileToDataUrl(currentFile.file);
        images = [imgUrl];
        textData = "[IMAGE]";
      }

      const result = await convertToLatexHtml(images, textData);
      setCurrentFile(prev => prev ? { 
        ...prev, 
        status: 'completed', 
        progress: 100, 
        result,
        sourceImages: images 
      } : null);
    } catch (err: any) {
      setCurrentFile(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadWord = async () => {
    if (currentFile?.result?.latex && currentFile.sourceImages) {
      const fileName = currentFile.file.name.split('.')[0] + "_PrecisionDigitized.doc";
      await downloadAsWord(
        currentFile.result.latex, 
        currentFile.sourceImages, 
        currentFile.result.figures || [], 
        fileName
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">MathDigitizer <span className="text-indigo-600">SmartCrop</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precision Image Extraction Engine</p>
            </div>
          </div>
          <button 
            onClick={handleSetupKey}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${hasKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-black'}`}
          >
            {hasKey ? '● API READY' : 'SETUP API KEY'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <h2 className="text-lg font-black text-slate-800 mb-6">Tải tài liệu</h2>
              <div 
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} />
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:text-indigo-600 group-hover:bg-white transition-all shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                </div>
                <p className="text-sm font-black text-slate-600">PDF, Word hoặc File Ảnh</p>
              </div>

              {currentFile && (
                <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                      {currentFile.type.includes('image') ? '🖼️' : '📄'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{currentFile.file.name}</p>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{currentFile.status}</p>
                    </div>
                  </div>
                  {currentFile.status === 'idle' && (
                    <button 
                      onClick={processFile} 
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      BẮT ĐẦU SỐ HÓA
                    </button>
                  )}
                  {currentFile.status === 'processing' && (
                    <div className="py-2 text-center">
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 animate-pulse w-full"></div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-black mt-3 uppercase tracking-widest">Đang phân tích & nhận diện hình vẽ...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-5 flex items-center gap-2">
                <span className="w-2 h-5 bg-indigo-600 rounded-full"></span> CÔNG NGHỆ CẮT ẢNH
              </h3>
              <ul className="text-xs space-y-4 text-slate-600 font-bold">
                <li className="flex gap-3 items-start"><span className="text-indigo-500">✔</span> <span>AI tự tìm tọa độ hình vẽ/đồ thị/BBT</span></li>
                <li className="flex gap-3 items-start"><span className="text-indigo-500">✔</span> <span>Cắt sát vùng bao, loại bỏ chữ dẫn</span></li>
                <li className="flex gap-3 items-start"><span className="text-indigo-500">✔</span> <span>Tự động nhúng ảnh đã cắt vào Word</span></li>
                <li className="flex gap-3 items-start"><span className="text-indigo-500">✔</span> <span>Hỗ trợ cả file ảnh chụp làm đầu vào</span></li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col min-h-[700px]">
            <div className="bg-white flex-grow rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
              <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Kết quả số hóa sạch</h2>
                <div className="flex gap-2">
                  {currentFile?.status === 'completed' && (
                    <button 
                      onClick={handleDownloadWord}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      TẢI WORD (ẢNH ĐÃ CẮT SÁT)
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-grow p-10 overflow-auto font-mono text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap selection:bg-indigo-100">
                {!currentFile && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40 italic">
                    <p className="text-sm font-black uppercase tracking-widest">Chưa có nội dung</p>
                  </div>
                )}
                
                {currentFile?.status === 'processing' && (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="w-10 h-10 border-[4px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                )}

                {currentFile?.status === 'completed' && (
                  <div>
                    {currentFile.result?.latex.split('\n').map((line, idx) => (
                      <div key={idx} className="mb-1">
                        {line.includes('[[FIG_') ? (
                          <div className="my-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-400 text-center uppercase">
                            {line} (AI đã xác định vùng cắt cho hình này)
                          </div>
                        ) : line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="max-w-6xl mx-auto py-12 text-center opacity-30">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em]">MathDigitizer SmartCrop &bull; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default App;
