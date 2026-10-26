#!/usr/bin/env python3
"""Score replies to the 100+ interaction posts. Usage: python update/replies.py raw_reply_files...
Raw files: X API v2 search responses for `conversation_id:<id> is:reply`. Writes data/replies.json and
adds reply metrics to data/posts.json + reply caveats to data/meta.json."""
import json, re, sys, os, glob
sys.path.insert(0, os.path.dirname(__file__))
from refresh import KW, TN, DATA
CAP = 50
POS = set('bullish strong great good love amazing impressive buy buying undervalued incredible massive opportunity huge win exciting congrats congratulations bullish 🚀 🔥 long winner best agree based king smart moon cheap brilliant legendary solid nice wow lfg'.split())
NEG = set('bubble loss losses burn risk junk overvalued insane ridiculous scam fraud dump short warning terrifying crash bankrupt doom worried concern red flag absurd ponzi circular cope trash garbage pass overpriced lol lmao clown joke dead fake stupid bad worst hype greedy greed bagholders exit liquidity nope never sell avoid hate terrible scary dangerous evil ripoff grift woke'.split())
AGREE = re.compile(r"\b(exactly|this\b|so true|true|agreed?|100%|facts|correct|well said|great (point|post|thread|summary)|thanks for|thank you|good (point|summary|breakdown)|spot on|precisely|absolutely|yes+\b|indeed|nailed it|💯)", re.I)
DISAGREE = re.compile(r"\b(wrong|lol no|no it|not true|false|fake news|cope|copium|nonsense|bs\b|bullshit|disagree|misleading|clickbait|that's not|thats not|doesn't|dont think|don't think|nah|nope|wtf|actually,|you're wrong|you are wrong|lies|lying|delusional|ignorant)", re.I)
ONT = re.compile(r"(anthropic|claude|ipo|s-1|s1\b|prospectus|filing|valuation|revenue|loss|burn|compute|dario|shares?|stock|nasdaq|\$ant|invest|ai\b|openai|bubble|trillion|\$\d|billion|market|founder|safety|risk)", re.I)
SPAMR = re.compile(r"(airdrop|memecoin|pump\.fun|presale|giveaway|\bCA:|contract address|whitelist|telegram|discord|dm me|check my (bio|profile)|follow (me|back)|join (my|our)|signals|promo|earn \$|perspective on|curious to hear your thoughts)", re.I)
EMO = re.compile(r"[\W_\d]+", re.U)
def clean(t): return re.sub(r'https?://\S+', '', re.sub(r'^(@\w+\s*)+', '', t)).strip()
def sentiment(t):
    w = re.findall(r"[\w$🚀🔥💯']+", t.lower()); p = sum(x in POS for x in w); n = sum(x in NEG for x in w)
    p += sum(k in t.lower() for k in ['red flag', 'exit liquidity']) * 0
    return round(max(-1, min(1, 0.34 * (p - n))), 2)
def topic(t):
    t = t.lower(); sc = {k: sum(w in t for w in ws) for k, ws in KW.items()}; b = max(sc, key=sc.get)
    return TN[b] if sc[b] > 0 else 'other'
def stance(t, s, orig_s):
    if DISAGREE.search(t): return 'disagree'
    if AGREE.search(t): return 'agree'
    if '?' in t: return 'neutral-question'
    if not ONT.search(t): return 'off-topic'
    if abs(orig_s) > 0.15 and abs(s) > 0.15: return 'agree' if (s > 0) == (orig_s > 0) else 'disagree'
    if abs(orig_s) <= 0.15 and s < -0.15: return 'disagree'  # pushback on neutral news = skepticism
    if abs(orig_s) <= 0.15 and s > 0.15: return 'agree'
    return 'neutral-question'
def load(path):
    s = open(path, encoding='utf-8', errors='ignore').read(); i = s.find('{"data"')
    if i < 0: return None
    try: return json.JSONDecoder().raw_decode(s[i:])[0]
    except Exception: return None
def main(files):
    posts = json.load(open(f'{DATA}/posts.json')); hi = {p['id']: p for p in posts if p.get('hi')}
    by = {k: {} for k in hi}; seen_raw = 0
    for f in files:
        d = load(f)
        if not d: continue
        users = {u['id']: u.get('username') for u in d.get('includes', {}).get('users', [])}
        for r in d['data']:
            c = r.get('conversation_id') or next((x['id'] for x in r.get('referenced_tweets', []) if x['type'] == 'replied_to'), None)
            if c in by and r['id'] != c:
                seen_raw += 1; r['_user'] = users.get(r.get('author_id')); by[c][r['id']] = r
    out = {}; dropped = {'spam': 0, 'emoji_or_short': 0, 'link_only': 0, 'author_self': 0}; total_raw = 0
    for cid, rs in by.items():
        P = hi[cid]; os_ = P['sentiment']; keep = []; total_raw += len(rs)
        for r in rs.values():
            t = r['text']; b = clean(t)
            if (r.get('_user') or '').lower() == P['handle'].lower(): dropped['author_self'] += 1; continue
            if SPAMR.search(t): dropped['spam'] += 1; continue
            if not b: dropped['link_only'] += 1; continue
            if len(EMO.sub('', b)) < 3 or len(b) < 8: dropped['emoji_or_short'] += 1; continue
            m = r['public_metrics']; eng = m['like_count'] + m['retweet_count'] + m['reply_count'] + m.get('quote_count', 0)
            s = sentiment(b)
            keep.append({'id': r['id'], 'url': r.get('url') or f"https://x.com/i/status/{r['id']}", 'handle': r.get('_user') or '', 'text': b[:400],
                         'date': r['created_at'][:10], 'eng': eng, 'sentiment': s, 'stance': stance(b, s, os_), 'topic': topic(b), 'kind': 'reply'})
        keep.sort(key=lambda x: -x['eng']); keep = keep[:CAP]; out[cid] = keep
        n = len(keep); w = [1 + x['eng'] for x in keep]
        if not n:
            P['replies'] = {'n': 0}; continue
        mean = sum(x['sentiment'] for x in keep) / n; wmean = sum(x['sentiment'] * wi for x, wi in zip(keep, w)) / sum(w)
        cnt = lambda k: sum(x['stance'] == k for x in keep)
        opined = cnt('agree') + cnt('disagree')
        pw = 1 + P['interactions']; comb = (os_ * pw + wmean * sum(w)) / (pw + sum(w))
        P['replies'] = {'n': n, 'mean': round(mean, 3), 'wmean': round(wmean, 3), 'delta': round(wmean - os_, 3),
            'agree': round(cnt('agree') / n, 3), 'disagree': round(cnt('disagree') / n, 3), 'question': round(cnt('neutral-question') / n, 3),
            'offtopic': round(cnt('off-topic') / n, 3), 'agree_of_opined': round(cnt('agree') / opined, 3) if opined else None,
            'combined': round(comb, 3), 'drift': round(sum(x['topic'] != P['topic'] for x in keep) / n, 3)}
    json.dump(posts, open(f'{DATA}/posts.json', 'w'), ensure_ascii=False, indent=0)
    json.dump({'cap_per_post': CAP, 'replies': out}, open(f'{DATA}/replies.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    meta = json.load(open(f'{DATA}/meta.json')); nk = sum(len(v) for v in out.values())
    meta['replies'] = {'posts': len(out), 'posts_with_replies': sum(1 for v in out.values() if v), 'raw': total_raw, 'kept': nk, 'dropped': dropped,
      'caveats': [
        'Replies come from X recent/full-archive search for each conversation, ranked by relevance. The API returned at most ~25 replies per post in one page, so the target cap of 50 was rarely reached; long threads are under-sampled and biased toward replies X ranks highly.',
        'Only direct and nested replies in the conversation are included. Quote posts were not collected (time/rate limits), so quote-tweet dunks — often the harshest pushback — are missing.',
        'Spam/promo, self-replies by the original author, link-only and emoji-only/very short replies were dropped by simple rules; some bots surely remain.',
        'Reply sentiment, stance and topic are keyword-scored (not hand-read). Sarcasm, non-English replies and memes are often misread; stance leans on cue words (\"exactly\", \"cope\", \"wrong\", \"?\") and on sentiment sign vs. the original.',
        'For neutral news posts, "agree" means positive/approving replies and "disagree" means negative/skeptical replies, since there is no opinion to agree with.',
        'Engagement weight = 1 + likes + reposts + replies + quotes of each reply. Combined conversation sentiment weights the original by its own interactions + 1.']}
    meta['caveats'] = [c for c in meta['caveats'] if 'Reply' not in c]
    json.dump(meta, open(f'{DATA}/meta.json', 'w'), ensure_ascii=False, indent=2)
    print('raw', total_raw, 'kept', nk, dropped)
if __name__ == '__main__': main(sys.argv[1:] or glob.glob('/workspace/agent-tools/*.txt'))
