import http from "http";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

// 🔐 Validação da chave
if (!process.env.GROQ_API_KEY) {
  console.error("ERRO: GROQ_API_KEY não encontrada no .env");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const PORT = 3000;
const MODEL = "llama-3.1-8b-instant"; // ✅ modelo atualizado

const HISTORICO = "historico.json";

// 📁 carregar histórico
function carregarHistorico() {
  try {
    if (fs.existsSync(HISTORICO)) {
      return JSON.parse(fs.readFileSync(HISTORICO, "utf-8"));
    }
  } catch (e) {
    console.error("Erro ao carregar histórico:", e);
  }
  return [];
}

// 💾 salvar histórico
function salvarHistorico(historico) {
  try {
    fs.writeFileSync(HISTORICO, JSON.stringify(historico, null, 2));
  } catch (e) {
    console.error("Erro ao salvar histórico:", e);
  }
}

// 🌐 servidor
const server = http.createServer((req, res) => {
  // 🔹 GET → serve HTML
  if (req.method === "GET") {
    try {
      const filePath = path.join(process.cwd(), "index.html");
      const html = fs.readFileSync(filePath, "utf-8");

      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(html);

    } catch (erro) {
      console.error("Erro ao carregar HTML:", erro);
      res.writeHead(500);
      return res.end("Erro ao carregar página");
    }
  }

  // 🔹 POST → chatbot
  if (req.method === "POST" && req.url === "/api/chat") {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        let dados;

        // 🛡️ validar JSON
        try {
          dados = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ resposta: "JSON inválido" }));
        }

        const pergunta = dados.pergunta;

        if (!pergunta) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ resposta: "Pergunta vazia" }));
        }

        let historico = carregarHistorico();

        historico.push({ role: "user", content: pergunta });

        // 🔥 limitar histórico
        historico = historico.slice(-10);

        console.log("Pergunta:", pergunta);

        // 🤖 chamada da IA
        const respostaIA = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: "Você é um orientador de carreira em TI. Responda de forma clara e útil."
            },
            ...historico
          ]
        });

        const texto = respostaIA.choices?.[0]?.message?.content || "Sem resposta";

        historico.push({ role: "assistant", content: texto });
        salvarHistorico(historico);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ resposta: texto }));

      } catch (erro) {
        console.error("ERRO NA IA:", erro);

        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          resposta: "Erro ao consultar IA"
        }));
      }
    });

    return;
  }

  // 🔹 Outros métodos ou URLs não são permitidos
  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ resposta: "Método não permitido" }));
});

// 🔥 Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});