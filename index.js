const fs = require("fs");
const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "prodmoveis.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
	db.run(
		`
			CREATE TABLE IF NOT EXISTS moveis (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nome TEXT NOT NULL,
				categoria TEXT NOT NULL,
				preco REAL NOT NULL CHECK (preco >= 0),
				estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
				created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`
	);
});

function validateMovelPayload(payload, partial = false) {
	const errors = [];

	if (!partial || payload.nome !== undefined) {
		if (typeof payload.nome !== "string" || payload.nome.trim().length < 2) {
			errors.push("nome deve ser texto com pelo menos 2 caracteres");
		}
	}

	if (!partial || payload.categoria !== undefined) {
		if (
			typeof payload.categoria !== "string" ||
			payload.categoria.trim().length < 2
		) {
			errors.push("categoria deve ser texto com pelo menos 2 caracteres");
		}
	}

	if (!partial || payload.preco !== undefined) {
		if (typeof payload.preco !== "number" || payload.preco < 0) {
			errors.push("preco deve ser numero maior ou igual a 0");
		}
	}

	if (!partial || payload.estoque !== undefined) {
		if (
			!Number.isInteger(payload.estoque) ||
			payload.estoque < 0
		) {
			errors.push("estoque deve ser inteiro maior ou igual a 0");
		}
	}

	return errors;
}

app.get("/", (_req, res) => {
	res.json({
		message: "API ProdMoveis funcionando",
		endpoints: {
			list: "GET /moveis",
			getById: "GET /moveis/:id",
			create: "POST /moveis",
			update: "PUT /moveis/:id",
			remove: "DELETE /moveis/:id",
		},
	});
});

app.get("/moveis", (_req, res) => {
	db.all("SELECT * FROM moveis ORDER BY id DESC", [], (err, rows) => {
		if (err) {
			return res.status(500).json({ error: "erro ao listar moveis" });
		}
		return res.json(rows);
	});
});

app.get("/moveis/:id", (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res.status(400).json({ error: "id invalido" });
	}

	db.get("SELECT * FROM moveis WHERE id = ?", [id], (err, row) => {
		if (err) {
			return res.status(500).json({ error: "erro ao buscar movel" });
		}
		if (!row) {
			return res.status(404).json({ error: "movel nao encontrado" });
		}
		return res.json(row);
	});
});

app.post("/moveis", (req, res) => {
	const errors = validateMovelPayload(req.body, false);
	if (errors.length > 0) {
		return res.status(400).json({ errors });
	}

	const { nome, categoria, preco, estoque } = req.body;

	db.run(
		`INSERT INTO moveis (nome, categoria, preco, estoque, updated_at)
		 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		[nome.trim(), categoria.trim(), preco, estoque],
		function onInsert(err) {
			if (err) {
				return res.status(500).json({ error: "erro ao cadastrar movel" });
			}

			return res.status(201).json({
				id: this.lastID,
				nome: nome.trim(),
				categoria: categoria.trim(),
				preco,
				estoque,
			});
		}
	);
});

app.put("/moveis/:id", (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res.status(400).json({ error: "id invalido" });
	}

	const errors = validateMovelPayload(req.body, false);
	if (errors.length > 0) {
		return res.status(400).json({ errors });
	}

	const { nome, categoria, preco, estoque } = req.body;

	db.run(
		`UPDATE moveis
		 SET nome = ?, categoria = ?, preco = ?, estoque = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		[nome.trim(), categoria.trim(), preco, estoque, id],
		function onUpdate(err) {
			if (err) {
				return res.status(500).json({ error: "erro ao atualizar movel" });
			}

			if (this.changes === 0) {
				return res.status(404).json({ error: "movel nao encontrado" });
			}

			return res.json({
				id,
				nome: nome.trim(),
				categoria: categoria.trim(),
				preco,
				estoque,
			});
		}
	);
});

app.delete("/moveis/:id", (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res.status(400).json({ error: "id invalido" });
	}

	db.run("DELETE FROM moveis WHERE id = ?", [id], function onDelete(err) {
		if (err) {
			return res.status(500).json({ error: "erro ao remover movel" });
		}
		if (this.changes === 0) {
			return res.status(404).json({ error: "movel nao encontrado" });
		}
		return res.status(204).send();
	});
});

app.use((req, res) => {
	res.status(404).json({ error: `rota nao encontrada: ${req.method} ${req.path}` });
});

process.on("SIGINT", () => {
	db.close(() => {
		process.exit(0);
	});
});

app.listen(PORT, () => {
	console.log(`Servidor rodando em http://localhost:${PORT}`);
});
