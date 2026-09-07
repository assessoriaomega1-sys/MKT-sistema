import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ExtractedReportData {
  alcance: number;
  cliques: number;
  conversoes: number;
  custoPorConversao: number;
  valorInvestido: number;
  dataInicial: string;
  dataFinal: string;
}

export async function extractMetricsFromImage(base64Image: string): Promise<ExtractedReportData | null> {
  const ai = getAI();
  
  const prompt = `
    Analise esta imagem de um gerenciador de anúncios e extraia as seguintes métricas métricas:
    1. Alcance (número de pessoas alcançadas)
    2. Cliques no link
    3. Conversas Iniciadas ou Resultados (conforme o tipo de campanha)
    4. Custo por Resultado/Conversa (em reais)
    5. Valor total investido (em reais)
    6. Período do relatório (Data de início e fim se disponível, caso contrário deixe vazio)

    Retorne APENAS um objeto JSON com o seguinte formato:
    {
      "alcance": number,
      "cliques": number,
      "conversoes": number,
      "custoPorConversao": number,
      "valorInvestido": number,
      "dataInicial": "string",
      "dataFinal": "string"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    
    return JSON.parse(text) as ExtractedReportData;
  } catch (error) {
    console.error("Erro ao extrair métricas:", error);
    return null;
  }
}
