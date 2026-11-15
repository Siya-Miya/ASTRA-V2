
const Fuse = require("fuse.js");
const path = require("path");

const cardsPath = path.join(
    __dirname,
    "../../KnowledgeBase/cards/part1.json"
);

const cards = require(cardsPath);

const fuse = new Fuse(cards, {
    keys: [
        { name: "title", weight: 3 },
        { name: "tags", weight: 3 },
        { name: "what_it_is", weight: 2 },
        { name: "spaceflight_effect", weight: 2 },
        { name: "red_flags", weight: 2 },
        { name: "measurement_notes", weight: 1 },
        { name: "context_notes", weight: 1 }
    ],
    includeScore: true,
    threshold: 0.4
});

const stopWords = [
    "how", "does", "do", "the", "a", "an",
    "is", "are", "was", "were", "what",
    "can", "could", "would", "should",
    "in", "on", "of", "to", "for",
    "and", "or", "with", "during", "affect"
];

function searchKnowledge(question) {

    if (!question || typeof question !== "string") {
        return [];
    }

    const terms = question
        .toLowerCase()
        .match(/[a-z0-9]+/g) || [];

    const keywords = terms.filter(
        word => !stopWords.includes(word)
    );

    const matches = new Map();

    for (const keyword of keywords) {

        const results = fuse.search(keyword);

        for (const result of results) {

            const id = result.item.card_id;

            if (!matches.has(id)) {
                matches.set(id, {
                    card: result.item,
                    score: result.score,
                    matchedTerms: []
                });
            }

            const match = matches.get(id);

            match.score = Math.min(
                match.score,
                result.score
            );

            match.matchedTerms.push(keyword);
        }
    }

    return Array.from(matches.values())
        .sort((a, b) => {
            if (b.matchedTerms.length !== a.matchedTerms.length) {
                return b.matchedTerms.length - a.matchedTerms.length;
            }

            return a.score - b.score;
        })
        .slice(0, 3);
}

module.exports = { searchKnowledge };
