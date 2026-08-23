import type { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/index.js";
import { adminRoutes } from "../modules/admin/index.js";
import { coursesRoutes } from "../modules/courses/index.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { dictionaryRoutes } from "../modules/dictionary/dictionary.routes.js";
import { favoriteVocabulariesRoutes } from "../modules/favorite-vocabularies/index.js";
import { grammarRoutes } from "../modules/grammar/index.js";
import { folderRoutes } from "../modules/folder/folder.routes.js";
import { kanjiRoutes } from "../modules/kanji/kanji.routes.js";

export async function registerRoutes(app: FastifyInstance) {
    await app.register(authRoutes);
    await app.register(adminRoutes);
    await app.register(coursesRoutes);
    await app.register(dashboardRoutes);
    await app.register(dictionaryRoutes);
    await app.register(favoriteVocabulariesRoutes);
    await app.register(grammarRoutes);
    await app.register(folderRoutes);
    await app.register(kanjiRoutes);
}

