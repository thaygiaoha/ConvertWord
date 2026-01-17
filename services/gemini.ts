
import { GoogleGenAI, Type } from "@google/genai";
import { ConversionResult } from "../types";

export const convertToLatexHtml = async (
  base64Images: string[],
  textContext: string = ""
): Promise<ConversionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';
  
  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64.split(',')[1] || base64
    }
  }));

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: `Dữ liệu gốc:\n${textContext}` }] },
    config: {
      systemInstruction: `Bạn là chuyên gia số hóa tài liệu toán học. Hãy gõ lại tài liệu và nhận diện vùng hình ảnh theo các quy tắc:

1. ĐỊNH DẠNG TOÁN HỌC:
   - Bao quanh công thức, biến số, đỉnh hình học bằng MỘT dấu $ (Ví dụ: $x^2$, $ABC$).
   - Hệ phương trình dùng \\begin{cases}. Ký hiệu độ dùng ^\\circ.

2. NHẬN DIỆN VÀ CẮT HÌNH (QUAN TRỌNG NHẤT):
   - Khi thấy hình vẽ, đồ thị, hoặc BBT, hãy chèn thẻ [[FIG_ID]] (với ID tự đặt, ví dụ FIG_0, FIG_1).
   - Bạn PHẢI trả về tọa độ vùng bao (bounding box) cho mỗi thẻ này trong danh sách "figures".
   - VÙNG BAO PHẢI ÔM SÁT HÌNH VẼ NHẤT CÓ THỂ. Tuyệt đối KHÔNG bao gồm chữ dẫn của câu hỏi, không bao gồm các phương án A, B, C, D. Chỉ lấy phần "hình" hoặc phần "bảng".
   - Tọa độ [ymin, xmin, ymax, xmax] chuẩn hóa từ 0-1000.

3. TRÌNH BÀY BBT:
   - Ngoài việc cắt hình, hãy vẫn gõ lại BBT dạng văn bản đơn giản dùng | và - (không dùng định dạng bảng markdown ---).
   - Dùng \\nearrow và \\searrow.

4. CẤU TRÚC VĂN BẢN:
   - Giữ nguyên Câu 1, Câu 2... và các phương án.
   - Bỏ qua Header và Footer.

Trả về JSON theo schema cung cấp.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          latex: { type: Type.STRING },
          html: { type: Type.STRING },
          figures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "ID tương ứng trong văn bản, ví dụ FIG_0" },
                source_index: { type: Type.INTEGER, description: "Chỉ số ảnh đầu vào (0, 1, 2...)" },
                box_2d: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER },
                  description: "[ymin, xmin, ymax, xmax] từ 0-1000"
                }
              },
              required: ["id", "source_index", "box_2d"]
            }
          }
        },
        required: ["latex", "html"]
      },
      temperature: 0,
    }
  });

  try {
    return JSON.parse(response.text || "{}") as ConversionResult;
  } catch (error) {
    console.error("Lỗi phân tích JSON:", error);
    throw new Error("Không thể xử lý. Vui lòng thử lại.");
  }
};
