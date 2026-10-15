import {test} from "node:test";
import assert from "node:assert/strict";
import {favoritesLesson as lesson} from "../packages/content/src/favorites.ts";
import {checkPreparedLesson} from "../packages/learning-core/src/content-check.ts";
import {assessFixed} from "../packages/learning-core/src/lesson.ts";
import {lessonConversationTarget} from "../packages/learning-core/src/lesson-target.ts";
import {assessNovelSentence} from "../packages/learning-core/src/sentence-assessment.ts";
import {lessonReviewIntroductions} from "../packages/learning-core/src/reviews.ts";
import {sessionProjection,type StudyEvent} from "../packages/learning-core/src/study.ts";
const exercise=(id:string)=>lesson.exercises.find(e=>e.id===id)!;
test("favorites checks the approved four kanji, original breakdowns and every approved fixed answer",()=>{
 assert.deepEqual(checkPreparedLesson(lesson),[]);
 assert.deepEqual(lesson.words.map(w=>w.kanji),["日","本","音","楽"]);
 assert.equal(lesson.exercises.length,19);
 for(const e of lesson.exercises)for(const answer of [...e.accepted,...(e.romaji??[])])assert(["independent","assisted"].includes(assessFixed(e,answer,[]).outcome),`${e.id}: ${answer}`);
 for(const sentence of [...lesson.words.map(w=>w.example),...lesson.grammar.examples])assert.equal(sentence.segments.map(s=>s.text).join(""),sentence.text);
});
test("Japan vocabulary and approved country readings stay distinct from the individual kanji meaning",()=>{
 assert.equal(assessFixed(exercise("meaning-japan"),"sun",[]).outcome,"independent");
 assert.equal(assessFixed(exercise("meaning-japan"),"Japan",[]).outcome,"incorrect");
 assert.equal(assessFixed(exercise("vocabulary-japan"),"Japan",[]).outcome,"independent");
 assert.equal(assessFixed(exercise("vocabulary-japan"),"sun",[]).outcome,"incorrect");
 assert.equal(assessFixed(exercise("meaning-book"),"books",[]).outcome,"independent");
 for(const input of ["にほん","にっぽん","nihon","nippon"])assert.equal(assessFixed(exercise("reading-japan"),input,[]).outcome,"independent");
 assert.equal(assessFixed(exercise("reading-japan"),"nichi",[]).outcome,"incorrect");
});
test("an accepted kanji comfort meaning cannot answer the whole-word music question",()=>{
 assert.equal(assessFixed(exercise("meaning-music"),"comfort",[]).outcome,"independent");
 assert.equal(assessFixed(exercise("vocabulary-music"),"comfort",[]).outcome,"incorrect");
 assert.equal(assessFixed(exercise("vocabulary-music"),"music",[]).outcome,"independent");
 assert.equal(assessFixed(exercise("reading-music"),"gaku",[]).outcome,"incorrect");
 assert.equal(assessFixed(exercise("reading-sound"),"on",[]).outcome,"incorrect");
});
test("preference statements, questions and assisted tiles do not turn into kana or speaking evidence",()=>{
 const own=exercise("likes-own");
 for(const input of ["音楽が好きです","本が好きです","ongaku ga suki desu ka"]){const value=assessFixed(own,input,[]);assert.equal(value.outcome,"independent");assert.equal(value.kanaEvidence,false);assert(value.targetObserved);}
 assert.equal(assessFixed(own,"音楽は好きです",[]).outcome,"validAlternative");
 assert.equal(assessFixed(own,"アニメが好きです",[]).outcome,"pending");
 assert.equal(assessFixed(own,"ongaku ga suki desu",["wordBank"]).outcome,"assisted");
 assert.equal(assessFixed(exercise("likes-tiles"),"本が好きです",[]).outcome,"assisted");
 assert.equal(assessFixed(exercise("reading-book"),"hon",[]).kanaEvidence,false);
});
test("novel likes and natural short responses use the checked target with exact learner evidence",()=>{
 const own=exercise("likes-own"),target=lessonConversationTarget(lesson)!;assert(target.forms.includes("好きです"));
 const source={id:"favorites-novel-answer",input:"anime ga suki desu",support:[]};
 const semantic={messageId:source.id,validity:"appropriate" as const,meaningfulJapanese:true,target:"used" as const,span:source.input,explanation:"An appropriate statement of an anime preference."};
 const result=assessNovelSentence(own,source,semantic,lesson);assert.equal(result.outcome,"independent");assert.equal(result.kanaEvidence,false);
 assert.equal(assessNovelSentence(own,{...source,input:"「アニメが好きです」という例です"},{...semantic,span:"アニメが好きです"},lesson).outcome,"pending");
});
test("completed favorites practice introduces fourteen separate initial tracks and two more only after a checked save",()=>{
 const now=Date.UTC(2026,9,15),base={sessionId:"favorites-session",deviceId:"favorites-device",lessonId:"favorites",lessonVersion:1,occurredAt:now,localDay:"2026-10-15",timezone:"UTC",offsetMinutes:0,support:[],spans:[]} as const;
 let seq=1;const events:StudyEvent[]=[{...base,eventId:"favorites-start",sequence:seq++,kind:"started",stepId:"goal",context:{theme:"Anime",band:"foundations",romaji:true,furigana:true,translations:true}}];
 for(const e of lesson.exercises){events.push({...base,eventId:`favorites-attempt-${e.id}`,sequence:seq++,kind:"attempted",stepId:e.id,input:e.accepted[0]});events.push({...base,eventId:`favorites-advance-${e.id}`,sequence:seq++,kind:"advanced",stepId:e.id});}
 assert.equal(sessionProjection(lesson,events).grammarState,"independent");
 const before=lessonReviewIntroductions(lesson,events);assert.equal(before.length,14);assert.equal(before.filter(i=>i.card.id.endsWith(":vocabulary-meaning")).length,2);
 events.push({...base,eventId:"favorites-saved",sequence:seq++,kind:"savedPhrase",stepId:"recap",input:"like-music"});
 const after=lessonReviewIntroductions(lesson,events);assert.equal(after.length,16);assert(after.every(i=>i.card.sourceId==="favorites"&&i.card.sourceVersion===1));
});
