import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {requestsLesson} from '../../packages/content/src/requests.ts';
import {checkPreparedLesson} from '../../packages/learning-core/src/content-check.ts';
import {manifestBody,validateContentManifest} from '../../packages/learning-core/src/content-package.ts';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function buildContentPackage(root){
  if(checkPreparedLesson(requestsLesson).length)throw Error('Lesson source checks failed.');
  const directory=path.join(root,'packages/content/assets/requests-v1');
  const lesson=Buffer.from(JSON.stringify(requestsLesson));
  const files=[{id:'lesson',kind:'lesson',mime:'application/json',data:lesson}];
  const expected=new Map([...requestsLesson.words.map(w=>[`word-${w.id}`,w.reading]),...requestsLesson.kana.map((k,i)=>[`kana-${i+1}`,k.character]),...requestsLesson.words.map(w=>[w.example.id,w.example.reading+'。']),...requestsLesson.grammar.examples.map(s=>[s.id,s.reading+'。'])]);
  for(const[id,reading]of [...expected].sort(([a],[b])=>a.localeCompare(b))){
    const metadata=JSON.parse(fs.readFileSync(path.join(directory,`${id}.json`),'utf8')),data=fs.readFileSync(path.join(directory,`${id}.wav`));
    if(metadata.id!==id || metadata.lessonId!==requestsLesson.id || metadata.lessonVersion!==requestsLesson.version || metadata.text!==reading || metadata.sha256!==hash(data) || !metadata.languageCheck?.matches || metadata.languageCheck.audioHash!==metadata.sha256)throw Error('Audio source checks failed.');
    files.push({id,kind:'audio',mime:'audio/wav',data});
  }
  const manifest={format:1,lessonId:requestsLesson.id,version:requestsLesson.version,title:requestsLesson.title,assets:files.map(f=>({id:f.id,kind:f.kind,mime:f.mime,bytes:f.data.length,sha256:hash(f.data)})),sha256:''};
  manifest.sha256=hash(manifestBody(manifest));validateContentManifest(manifest);
  return {manifest,files};
}
