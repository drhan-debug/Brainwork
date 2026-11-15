// A scenario has been visited once every sentence has a progress record, even if
// some answers were wrong and are due for review.
export function nextIncompleteScenario(scenarios, sentenceProgress) {
 return scenarios.find(scene=>scene.sentences.some(sentence=>!Object.hasOwn(sentenceProgress, sentence.id)))||null;
}
