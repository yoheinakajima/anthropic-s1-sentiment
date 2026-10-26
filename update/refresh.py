#!/usr/bin/env python3
"""Merge new raw X search results into data/posts.json and regenerate data/meta.json.

Usage:
  python update/refresh.py raw/*.json            # merge X API v2 search responses
  python update/refresh.py --seed-csv all.csv hi.csv   # (one-off) build from research CSVs
Raw files: X API v2 responses ({"data":[...],"includes":{"users":[...]}}); leading junk before
the first '{"data"' is tolerated. Existing posts get refreshed interaction/view counts but keep
their scores; new relevant posts are scored with the same keyword rules used in the research.
"""
import json, re, sys, csv, os, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
TN = {'R':'Revenue growth & profitability','L':'Losses, burn & financing','V':'Valuation & AI-bubble',
      'G':'Governance & founder control','P':'Compute deals & partners',
      'S':'Safety / existential-risk disclosures','T':'IPO timing & market impact'}
KW = {'S':['risk','existential','catastroph','safety','shutdown','alignment','doom','blackmail','滅亡','멸망'],
 'G':['voting','class f','founder','dual-class','ltbt','benefit trust','governance','control','lock-up','lockup','dario earned'],
 'L':['loss','burn','debt','credit','rating','junk','financing','cash','赤字','손실'],
 'P':['compute','tpu','nvidia','broadcom','google','amazon','aws','cloud','chips','gpu','iren'],
 'V':['valuation','trillion','$2t','$1.5t','bubble','overvalued','tulip','兆','조 달러','perp'],
 'R':['revenue','arr','growth','profit','margin','customers','売上','营收','매출'],
 'T':['date','november','week','ipo day','debut','listing','nasdaq','ticker','etf','priced','roadshow','timing','delay']}
POS='bullish strong surge growth record profit impressive buy undervalued incredible massive opportunity beat huge win exciting 🚀 long'.split()
NEG='bubble loss losses burn risk existential junk overvalued insane ridiculous scam fraud dump short warning terrifying crash bankrupt doom worried concern delay red flag catastroph absurd incinerator ponzi circular'.split()
REL=re.compile(r'(ipo|s-1|s1\b|prospectus|filing|上場|目論見|上市|招股|상장|투자설명서|börsengang|bourse|cotiza|\$ant\b)',re.I)
ANT=re.compile(r'(anthropic|アンソロピック|앤트로픽|claude|\$ant\b)',re.I)
SPAM=re.compile(r'(airdrop|memecoin|pump\.fun|presale|giveaway|\bCA:|contract address|whitelist|join (my|our) (telegram|discord))',re.I)

def topic(t):
    t=t.lower(); sc={k:sum(w in t for w in ws) for k,ws in KW.items()}
    b=max(sc,key=sc.get); return TN[b if sc[b]>0 else 'T']
def sentiment(t):
    t=t.lower(); p=sum(w in t for w in POS); n=sum(w in t for w in NEG)
    return round(max(-1,min(1,0.25*(p-n))),2)
def relevant(t):
    body=re.sub(r'https?://\S+|@\w+','',t).strip()
    return not t.startswith('RT @') and ANT.search(t) and REL.search(t) and not SPAM.search(t) and len(body)>=40

def load_raw(path):
    s=open(path,encoding='utf-8').read(); i=s.find('{"data"'); i=0 if i<0 else i
    obj,_=json.JSONDecoder().raw_decode(s[i:]); return obj
def pid(url): return url.rstrip('/').split('/')[-1]

def load_posts():
    p=os.path.join(DATA,'posts.json')
    return {x['id']:x for x in json.load(open(p))} if os.path.exists(p) else {}

def merge(posts, raw_paths):
    added=updated=0
    for rp in raw_paths:
        obj=load_raw(rp); users={u['id']:u['username'] for u in obj.get('includes',{}).get('users',[])}
        for t in obj.get('data',[]) or []:
            m=t.get('public_metrics',{}); eng=sum(m.get(k,0) for k in ('like_count','retweet_count','reply_count','quote_count'))
            if t['id'] in posts:
                p=posts[t['id']]; p['interactions']=max(p['interactions'],eng); p['views']=m.get('impression_count',p.get('views')); updated+=1; continue
            text=t.get('text','')
            if not relevant(text): continue
            h=users.get(t.get('author_id'),'i')
            posts[t['id']]=dict(id=t['id'],url=f"https://x.com/{h}/status/{t['id']}",handle=h,date=t.get('created_at','')[:10],
                interactions=eng,views=m.get('impression_count'),language=t.get('lang',''),sentiment=sentiment(text),
                topic=topic(text),method='keyword',summary=re.sub(r'\s+',' ',re.sub(r'https?://\S+','',text)).strip()[:200])
            added+=1
    return added,updated

def seed(csvs, posts):
    for c in csvs:
        for r in csv.DictReader(open(c,encoding='utf-8')):
            i=pid(r['url']); v=r.get('impressions')
            posts[i]=dict(id=i,url=r['url'],handle=r['author'],date=r['date'],interactions=int(r['engagement']),
                views=int(v) if v not in ('',None) else None,language=r.get('lang',''),sentiment=float(r['sentiment']),
                topic=r['topic'],method='hand' if r.get('label_method')=='manual' else 'keyword',summary=r['summary'])

def write(posts, note=''):
    L=sorted(posts.values(),key=lambda p:-p['interactions'])
    for p in L: p['hi']=p['interactions']>=100
    json.dump(L,open(os.path.join(DATA,'posts.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
    mp=os.path.join(DATA,'meta.json'); meta=json.load(open(mp)) if os.path.exists(mp) else {}
    meta.update(last_updated=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        counts=dict(total=len(L),hi=sum(p['hi'] for p in L),hand=sum(p['method']=='hand' for p in L),keyword=sum(p['method']=='keyword' for p in L)),
        date_range=[min(p['date'] for p in L),max(p['date'] for p in L)])
    if note: meta['last_update_note']=note
    json.dump(meta,open(mp,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
    print(f"wrote {len(L)} posts ({meta['counts']['hi']} with >=100 interactions)")

if __name__=='__main__':
    a=sys.argv[1:]; posts=load_posts()
    if a and a[0]=='--seed-csv': seed(a[1:],posts); write(posts,'seeded from research CSVs')
    else:
        ad,up=merge(posts,a); print(f'added {ad}, refreshed {up}'); write(posts,f'merged {len(a)} raw file(s): +{ad} new, {up} refreshed')
