#!/usr/bin/env python3
"""Pull recent posts via the official X API v2 recent search (last 7 days) into update/raw/.
Needs env X_BEARER_TOKEN. Exits 0 without doing anything if it's missing."""
import os, sys, json, time, urllib.request, urllib.parse, datetime as dt
tok=os.environ.get('X_BEARER_TOKEN')
if not tok: print('X_BEARER_TOKEN not set; skipping fetch.'); sys.exit(0)
QUERIES=['Anthropic (IPO OR S-1 OR prospectus OR filing) -is:retweet',
         '(Anthropic OR $ANT) (valuation OR revenue OR loss OR "Class F" OR risk) (S-1 OR IPO) -is:retweet']
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw'); stamp=dt.datetime.utcnow().strftime('%Y%m%dT%H%M%S')
for qi,q in enumerate(QUERIES):
    nt=None
    for page in range(int(os.environ.get('X_MAX_PAGES','5'))):
        p={'query':q,'max_results':100,'tweet.fields':'created_at,public_metrics,author_id,lang','expansions':'author_id','user.fields':'username'}
        if nt: p['next_token']=nt
        r=urllib.request.Request('https://api.x.com/2/tweets/search/recent?'+urllib.parse.urlencode(p),headers={'Authorization':'Bearer '+tok})
        try: d=json.load(urllib.request.urlopen(r,timeout=30))
        except Exception as e: print('fetch error:',e); break
        json.dump(d,open(f'{out}/x_{stamp}_{qi}_{page}.json','w'),ensure_ascii=False)
        nt=d.get('meta',{}).get('next_token')
        if not nt: break
        time.sleep(1)
