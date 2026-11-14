
const { searchKnowledge } = require("./knowledgeSearch");

function buildKnowledgeAnswer(question) {

    const results = searchKnowledge(question);

    // No reliable research match found
    if (results.length === 0 || results[0].score > 0.65) {
        return {
            found: false,
            message: "ASTRA could not find sufficiently relevant information in its current knowledge base.",
            recommendation: "Consult the mission-approved medical protocol or flight surgeon."
        };
    }

    // Use the strongest research match
    const bestMatch = results[0];
    const card = bestMatch.card;

    return {
        found: true,

        question: question,

        topic: {
            id: card.card_id,
            title: card.title,
            category: card.category
        },

        answer: {
            explanation: card.what_it_is,
            spaceflightContext: card.spaceflight_effect,
            warningSigns: card.red_flags,
            escalationGuidance: card.escalate_when,
            generalActions: card.general_actions,
            measurementNotes: card.measurement_notes
        },

        evidence: {
            confidence: card.confidence,
            confidenceReason: card.confidence_reason,
            contentType: card.content_type,
            matchedTerms: bestMatch.matchedTerms
        },

        source: {
            title: card.source_title,
            organisation: card.source_org,
            url: card.source_url,
            date: card.source_date,
            section: card.source_section,
            licence: card.licence
        },

        disclaimer: "ASTRA provides research-based reference information, not a diagnosis or a replacement for mission-approved medical guidance."
    };
}

module.exports = { buildKnowledgeAnswer };

