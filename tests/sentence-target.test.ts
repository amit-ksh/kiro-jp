import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directionsLesson} from '../packages/content/src/directions.ts';
import {requestsLesson} from '../packages/content/src/requests.ts';
import {assessNovelSentence} from '../packages/learning-core/src/sentence-assessment.ts';
import {lessonReviewIntroductions} from '../packages/learning-core/src/reviews.ts';
import type {PreparedLesson} from '../packages/learning-core/src/lesson.ts';
import type {StudyEvent} from '../packages/learning-core/src/study.ts';

function assess(lesson:PreparedLesson,input:string,support:('wordBank')[]=[]){
 const exercise=lesson.exercises.find(e=>e.kind==='sentence')!;
 const source={id:'novel-location-answer',input,support};
 const semantic={messageId:source.id,validity:'appropriate' as const,meaningfulJapanese:true,target:'used' as const,span:input,explanation:'The learner uses the checked target appropriately.'};
 return assessNovelSentence(exercise,source,semantic,lesson);
}
test('novel location answers use the pinned location target rather than the request pattern',()=>{
 assert.equal(assess(directionsLesson,'トイレはどこですか。').outcome,'independent');
 assert.equal(assess(directionsLesson,'toire wa doko desu ka').outcome,'independent');
 assert.equal(assess(directionsLesson,'トイレはどこですか。',['wordBank']).outcome,'assisted');
 assert.equal(assess(directionsLesson,'コーヒーをください。').outcome,'pending');
 assert.equal(assess(requestsLesson,'トイレはどこですか。').outcome,'pending');
 assert.equal(assess(requestsLesson,'コーヒーをください。').outcome,'independent');
});
test('resolved novel location evidence introduces its grammar review without claiming kana literacy',()=>{
 const input='トイレはどこですか。',now=Date.UTC(2026,9,15,0),exercise=directionsLesson.exercises.find(e=>e.kind==='sentence')!;
 const base={sessionId:'novel-location-session',deviceId:'novel-location-device',lessonId:'directions',lessonVersion:1,occurredAt:now,localDay:'2026-10-15',timezone:'UTC',offsetMinutes:0,support:[],spans:[]} as const;
 const events:StudyEvent[]=[{...base,eventId:'location-start',sequence:1,kind:'started',stepId:'goal',context:{theme:'Shrines',band:'foundations',romaji:true,furigana:true,translations:true}},{...base,eventId:'novel-location-answer',sequence:2,kind:'attempted',stepId:exercise.id,input},{...base,eventId:'location-advanced',sequence:3,kind:'advanced',stepId:exercise.id}];
 assert.equal(lessonReviewIntroductions(directionsLesson,events).length,0);
 const checked=assess(directionsLesson,input);assert.equal(checked.kanaEvidence,false);
 const introduced=lessonReviewIntroductions(directionsLesson,events,{'novel-location-answer':checked});
 assert.deepEqual(introduced.map(i=>i.card.id),['directions:1:location-doko:grammar']);
});
