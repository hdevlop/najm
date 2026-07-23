
import { Controller } from "diject";
import { i18n, I18n, I18nOptions, I18nService, type TFn } from "../src";
import {   Server } from "najm-core";
import { Params, Get } from "najm-core";

let server: Server;
let baseURL: string;

const enTranslations = {
    greeting: "Hello",
    farewell: "Goodbye",
    welcome: "Welcome, {{name}}!",
    items: {
        count: "You have {{count}} items",
        empty: "No items found",
    },
    errors: {
        notFound: "Resource not found",
        unauthorized: "You are not authorized",
        validation: {
            required: "{{field}} is required",
            minLength: "{{field}} must be at least {{min}} characters",
        },
    },
    buttons: {
        submit: "Submit",
        cancel: "Cancel",
        save: "Save Changes",
    },
    pages: {
        home: {
            title: "Home Page",
            description: "Welcome to our application",
        },
        about: {
            title: "About Us",
            description: "Learn more about our company",
        },
    },
};

const frTranslations = {
    greeting: "Bonjour",
    farewell: "Au revoir",
    welcome: "Bienvenue, {{name}}!",
    items: {
        count: "Vous avez {{count}} articles",
        empty: "Aucun article trouvé",
    },
    errors: {
        notFound: "Ressource non trouvée",
        unauthorized: "Vous n'êtes pas autorisé",
        validation: {
            required: "{{field}} est requis",
            minLength: "{{field}} doit contenir au moins {{min}} caractères",
        },
    },
    buttons: {
        submit: "Soumettre",
        cancel: "Annuler",
        save: "Enregistrer",
    },
    pages: {
        home: {
            title: "Page d'accueil",
            description: "Bienvenue dans notre application",
        },
        about: {
            title: "À propos de nous",
            description: "En savoir plus sur notre entreprise",
        },
    },
};

const arTranslations = {
    greeting: "مرحبا",
    farewell: "وداعا",
    welcome: "أهلاً {{name}}!",
    items: {
        count: "لديك {{count}} عناصر",
        empty: "لا توجد عناصر",
    },
    errors: {
        notFound: "المورد غير موجود",
        unauthorized: "غير مصرح لك",
    },
};

const defaultI18nConfig = {
    translations: {
        en: enTranslations,
        fr: frTranslations,
        ar: arTranslations,
    },
    defaultLanguage: "en",
    supportedLanguages: ["en", "fr", "ar"],
    order: ["querystring", "cookie", "header"],
    lookupQueryString: "lang",
    lookupCookie: "language",
} satisfies I18nOptions;

@Controller("/i18n")
class I18nController {
    constructor(private i18n: I18nService) { }

    @Get("/welcome/:name")
    getWelcome(@Params("name") name: string) {
        return { message: this.i18n.t("welcome", { name }) };
    }
}

server = await new Server()
    .use(i18n(defaultI18nConfig))
    .load(I18nController)
    .listen(5010);

baseURL = "http://localhost:5010";

const response = await fetch(`${baseURL}/i18n/welcome/John`);
const data = await response.json();
