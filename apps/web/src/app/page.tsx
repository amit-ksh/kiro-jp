import Image from "next/image";
import { ArrowUpRight, BookOpen, MessageCircle, RotateCcw } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { preparedLessons } from "../../../../packages/content/src/curriculum";

const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL?.trim() ||
  "https://expo.dev/artifacts/eas/LKKOEmX-vqBfe9Dll7xiDFMV-OSbdRi51oOH-wSubI0.apk";
const firstLesson = preparedLessons[0];
const example = firstLesson.grammar.examples[0];

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Kiro JP home">
      <Image src="/kiro-mark.svg" alt="" width={38} height={38} priority />
      <span>Kiro JP</span>
    </a>
  );
}

export default function LandingPage() {
  return (
    <div id="top">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <nav className="container navigation" aria-label="Main navigation">
          <Brand />
          <div className="nav-links">
            <a href="#learning">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <DownloadButton apkUrl={APK_URL} compact />
        </nav>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-layout">
            <div className="hero-copy">
              <h1 id="hero-title">
                Japanese
                <br />
                you can <span>use.</span>
              </h1>
              <p>
                Learn kanji, useful grammar and conversations around your
                interests.
              </p>
              <DownloadButton apkUrl={APK_URL} />
              <p className="download-note">
                Android preview · No iOS release yet
              </p>
              <a className="text-link" href="#learning">
                See how a session works{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
            <figure className="app-preview">
              <div className="phone-frame">
                <div className="screen-crop">
                  <Image
                    src="/media/kiro-grammar-android.png"
                    alt="Android grammar reference explaining をください: request water, tea or a book politely in a shop or café."
                    width={720}
                    height={1600}
                    priority
                  />
                </div>
              </div>
              <figcaption>Grammar reference · Android app detail</figcaption>
            </figure>
          </div>
        </section>
        <section
          className="section container"
          id="learning"
          aria-labelledby="learning-title"
        >
          <div className="section-intro">
            <h2 id="learning-title">
              From a new word
              <br />
              to your own sentence.
            </h2>
            <p>
              One study session connects what you remember with what you want to
              say.
            </p>
          </div>
          <ol className="learning-steps">
            <li>
              <BookOpen aria-hidden="true" size={26} />
              <h3>Learn</h3>
              <p>
                A small kanji set, word readings and one useful grammar pattern.
                Explore the components behind each kanji.
              </p>
            </li>
            <li>
              <MessageCircle aria-hidden="true" size={26} />
              <h3>Practise</h3>
              <p>
                Listen, record and build sentences. Try a conversation with
                hints, translations and corrections.
              </p>
            </li>
            <li>
              <RotateCcw aria-hidden="true" size={26} />
              <h3>Review</h3>
              <p>
                Revisit meanings and readings separately. Save useful phrases
                and return when your reviews are due.
              </p>
            </li>
          </ol>
        </section>
        <section className="lesson-section" aria-labelledby="lesson-title">
          <div className="container lesson-layout">
            <div>
              <h2 id="lesson-title">
                A little Japanese.
                <br />
                An everyday use.
              </h2>
              <p>
                Start with “{firstLesson.title.toLowerCase()}”: learn{" "}
                {firstLesson.words.map((word) => word.kanji).join("、")} and use
                them to request something politely.
              </p>
              <p>
                Choose food, culture, places, anime or manga. Qloo helps suggest
                conversation topics around your interests. You can change the
                subject whenever you like.
              </p>
            </div>
            <div className="sentence-example">
              <span className="example-label">From the first lesson</span>
              <p className="japanese" lang="ja">
                {example.text}
              </p>
              <p className="reading" lang="ja">
                {example.reading}
              </p>
              <p className="meaning">{example.meaning}</p>
              <div className="pattern">
                <span>Pattern</span>
                <strong lang="ja">{firstLesson.grammar.pattern}</strong>
              </div>
            </div>
          </div>
          <div className="container">
            <details className="curriculum">
              <summary>
                Explore the {preparedLessons.length} starter lessons
              </summary>
              <p className="curriculum-note">
                Focused N5/N4 practice. These starter lessons are not a complete
                JLPT course.
              </p>
              <ol className="curriculum-list">
                {preparedLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <div>
                      <h3>{lesson.title}</h3>
                      <p>{lesson.outcome}</p>
                    </div>
                    <span lang="ja">{lesson.grammar.pattern}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </section>
        <section
          className="section container download-section"
          id="android"
          aria-labelledby="download-title"
        >
          <div>
            <h2 id="download-title">
              Your next phrase
              <br />
              starts here.
            </h2>
            <p>Try Kiro JP on Android.</p>
          </div>
          <div className="install-area">
            <DownloadButton apkUrl={APK_URL} />
            <p className="download-note">v0.2.13 · APK · 102.8 MB</p>
            <details className="install-help">
              <summary>How do I install the APK?</summary>
              <ol>
                <li>Download the APK on your Android phone.</li>
                <li>
                  Open the file and allow installation from your browser if
                  Android asks.
                </li>
                <li>Install Kiro JP, then open the app to get started.</li>
              </ol>
              <p>
                Requires Android 7.0 or later. This preview is distributed
                directly, outside Google Play.
              </p>
            </details>
          </div>
        </section>
        <section
          className="faq-section container"
          id="faq"
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">A few useful answers.</h2>
          <div className="faq-list">
            <details>
              <summary>Can I start without knowing Japanese?</summary>
              <p>
                Yes. Choose “Completely new” or “I’m not sure” during setup. A
                short optional level check helps recommend a starting point,
                with readings, English explanations and romaji support
                available.
              </p>
            </details>
            <details>
              <summary>What can I study offline?</summary>
              <p>
                Previously downloaded lessons, flashcards, references and model
                audio. New AI replies, Qloo suggestions, WaniKani imports and
                account synchronization need an internet connection.
              </p>
            </details>
            <details>
              <summary>Can I bring my WaniKani progress?</summary>
              <p>
                Yes. An optional import identifies familiar kanji and
                vocabulary. Grammar, listening and speaking are tracked
                separately.
              </p>
            </details>
            <details>
              <summary>How does speaking practice work?</summary>
              <p>
                Listen to model audio, record your attempt and check the
                recognized transcript before submitting. Replay, retry or type
                instead. Speech recognition requires internet.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <Brand />
        <p>Kanji. Grammar. Conversation.</p>
        <nav aria-label="Footer navigation">
          <a href="#learning">Learning</a>
          <a href="#android">Android</a>
          <a href="#faq">FAQ</a>
        </nav>
      </footer>
    </div>
  );
}
