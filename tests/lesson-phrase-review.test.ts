import {test} from 'node:test';import assert from 'node:assert/strict';
import {directionsLesson} from '../packages/content/src/directions.ts';
import {requestsLesson} from '../packages/content/src/requests.ts';
import {lessonReviewIntroductions} from '../packages/learning-core/src/reviews.ts';
import {assessFixed,type PreparedLesson} from '../packages/learning-core/src/lesson.ts';
import type {StudyEvent} from '../packages/learning-core/src/study.ts';
function saved(lesson:PreparedLesson):StudyEvent[]{
 const now=Date.UTC(2026,9,15),base={sessionId:'saved-phrase-session',deviceId:'saved-phrase-device',lessonId:lesson.id,lessonVersion:lesson.version,occurredAt:now,localDay:'2026-10-15',timezone:'UTC',offsetMinutes:0,support:[],spans:[]} as const;
 return [{...base,eventId:'saved-phrase-start',sequence:1,kind:'started',stepId:'goal',context:{theme:'Shrines',band:'foundations',romaji:true,furigana:true,translations:true}},{...base,eventId:'saved-phrase-event',sequence:2,kind:'savedPhrase',stepId:'recap',input:lesson.grammar.examples[0]!.id}];
}
test('saving a checked lesson sentence creates meaning and whole-sentence reading reviews',()=>{
 for(const lesson of [requestsLesson,directionsLesson]){
  const events=saved(lesson),cards=lessonReviewIntroductions(lesson,events);assert.equal(cards.length,2);
  const sentence=lesson.grammar.examples[0]!;
  assert.deepEqual(cards.map(i=>i.card.facet),['meaning','reading']);
  assert(cards.every(i=>i.card.source==='lesson'&&i.card.sourceId===lesson.id&&i.card.sourceVersion===lesson.version&&i.card.exercise.targetId===sentence.id));
  assert.equal(assessFixed(cards[0]!.card.exercise,sentence.meaning,[]).outcome,'independent');
  const reading=assessFixed(cards[1]!.card.exercise,sentence.romaji,[]);assert.equal(reading.outcome,'independent');assert.equal(reading.kanaEvidence,false);assert.equal(reading.targetObserved,false);
  assert.equal(lessonReviewIntroductions(lesson,[events[0]!]).length,0);
 }
});
test('repeat saves retain one pair, an original study date and the exact checked content version',()=>{
 const events=saved(directionsLesson),save=events[1]!,later={...save,eventId:'saved-phrase-repeat',sequence:3,occurredAt:save.occurredAt+1000};
 const once=lessonReviewIntroductions(directionsLesson,events),twice=lessonReviewIntroductions(directionsLesson,[...events,later]);assert.equal(once.length,2);assert.deepEqual(twice,once);
 assert(twice.every(i=>i.introducedAt===save.occurredAt));
 assert.equal(lessonReviewIntroductions(directionsLesson,[events[0]!,{...save,input:'unknown-example'}]).length,0);
});
