'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HeartFeedItem } from '@/lib/heartFeed';

interface HeartFeedResponse {
  items?: HeartFeedItem[];
  error?: string;
}

function formatArticleDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Latest update';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function HeartIntelSection() {
  const [items, setItems] = useState<HeartFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      try {
        const res = await fetch('/api/heart-feed', { cache: 'no-store' });
        const json = (await res.json()) as HeartFeedResponse;

        if (!active) return;

        if (!res.ok) {
          setError(json.error || 'Failed to load live heart intelligence.');
          setLoading(false);
          return;
        }

        setItems(Array.isArray(json.items) ? json.items : []);
        setError('');
      } catch {
        if (!active) return;
        setError('Unable to reach live sources right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadFeed();
    const intervalId = window.setInterval(() => {
      void loadFeed();
    }, 5 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const duplicatedItems = useMemo(() => {
    if (items.length === 0) return [];
    return [...items, ...items];
  }, [items]);

  return (
    <section className="intel-sec" id="heart-intel">
      <div className="sec-in">
        <div className="intel-head">
          <div>
            <div className="s-eye">Heart Intel</div>
            <h2 className="intel-title">
              Live reporting and newly published studies around heart attacks.
            </h2>
          </div>
          <p className="intel-sub">
            This feed blends current news coverage with recent research so visitors can track what is
            happening now and open the original source in one click.
          </p>
        </div>

        <div className="intel-band">
          {loading && (
            <div className="intel-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="intel-card intel-card--skeleton" key={index}>
                  <div className="skeleton-line short" />
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="intel-empty">
              <h3>Live feed unavailable</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="intel-empty">
              <h3>No live items yet</h3>
              <p>
                Add `NEWSAPI_KEY` in your environment to enable live news, while PubMed studies can
                still appear whenever source responses are available.
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="intel-marquee">
              <div className="intel-track">
                {duplicatedItems.map((item, index) => (
                  <a
                    key={`${item.id}-${index}`}
                    className="intel-card"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="intel-card__meta">
                      <span className={`intel-pill intel-pill--${item.kind}`}>
                        {item.kind === 'study' ? 'Study' : 'News'}
                      </span>
                      <span className="intel-source">{item.source}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div className="intel-card__foot">
                      <span>{formatArticleDate(item.publishedAt)}</span>
                      <span>Open source</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
