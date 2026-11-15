
const Fuse = require("fuse.js");
const path = require("path");

const cardsPath = path.join(
    __dirname,
    "../../KnowledgeBase/cards/part1.json"
);

const cards = require(cardsPath);

// Search across the actual research content.
const fuse = new Fuse(cards, {
    keys: [
        { name: "title", weight: 3 },
        { name: "tags", weight: 3 },
        { name: "what_it_is", weight: 2 },
        { name: "spaceflight_effect", weight: 2 },
        { name: "red_flags", weight: 3 },
        { name: "escalate_when", weight: 2 },
        { name: "general_actions", weight: 1 },
        { name: "measurement_notes", weight: 1 },
        { name: "context_notes", weight: 1 }
    ],

    includeScore: true,
    threshold: 0.4
});

// Remove generic words that do not describe the actual issue.
const stopWords = new Set([
    "how", "does", "do", "the", "a", "an",
    "is", "are", "was", "were", "what",
    "can", "could", "would", "should",
    "in", "on", "of", "to", "for",
    "and", "or", "with", "during", "affect",

    "astronaut", "astronauts", "crew",
    "reported", "report", "reporting",
    "symptom", "symptoms", "body", "region",
    "severity", "onset", "just", "now",
    "mild", "moderate", "severe",
    "relevant", "spaceflight", "space",
    "health", "research", "warning",
    "signs", "escalation", "guidance",
    "available", "mean", "means",
    "persistent", "anomaly", "detected",
    "investigation", "recommended"
]);

function searchKnowledge(question) {

    if (!question || typeof question !== "string") {
        return [];
    }

    // Extract meaningful keywords.
    const terms = question
        .toLowerCase()
        .match(/[a-z0-9]+/g) || [];

    const keywords = [
        ...new Set(
            terms.filter(word =>
                word.length > 2 &&
                !stopWords.has(word)
            )
        )
    ];

    if (keywords.length === 0) {
        return [];
    }

    const matches = new Map();

    // Search each meaningful keyword.
    for (const keyword of keywords) {

        const results = fuse.search(keyword);

        for (const result of results) {

            const id = result.item.card_id;

            if (!matches.has(id)) {

                matches.set(id, {
                    card: result.item,
                    score: result.score ?? 1,
                    matchedTerms: []
                });

            }

            const match = matches.get(id);

            // Keep the strongest relevance score.
            match.score = Math.min(
                match.score,
                result.score ?? 1
            );

            if (!match.matchedTerms.includes(keyword)) {
                match.matchedTerms.push(keyword);
            }

        }

    }

    // Rank using meaningful keyword matches,
    // not generic words from the question.
    return Array.from(matches.values())

        .sort((a, b) => {

            if (
                b.matchedTerms.length !==
                a.matchedTerms.length
            ) {

                return (
                    b.matchedTerms.length -
                    a.matchedTerms.length
                );

            }

            return a.score - b.score;

        })

        .slice(0, 3);

}

module.exports = { searchKnowledge };
