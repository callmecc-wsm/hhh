#!/usr/bin/env python3
"""Rebuild the course's 72 light figures from original.json (Pillow + Noto CJK).

Run: /tmp/figvenv/bin/python scripts/render-figures.py
Optional: --review-dir PATH (backups, contact sheets, text/bounds audit).
Source copy is never edited. Backups are copied only when absent.
All numbers outside source formulas are explicitly illustrative or calculated.
"""
from pathlib import Path
import argparse, json, math, shutil, subprocess
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG, WHITE, INK, MUTED = '#f7f8fa', '#ffffff', '#1f2329', '#4e5969'
GREEN, BLUE, AMBER = '#0f6e56', '#3370ff', '#b86e00'
PALE, LINE = '#e8f3ef', '#d4dae0'
COLORS = [GREEN, BLUE, AMBER]
CJK = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
LATIN = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

@lru_cache(None)
def charset(path):
    data = subprocess.check_output(['fc-query', '--format=%{charset}', path], text=True).split('\n')[0]
    ranges=[]
    # TTC query may concatenate identical charsets; membership is sufficient.
    for part in data.split():
        try:
            ends=part.split('-'); ranges.append((int(ends[0],16),int(ends[-1],16)))
        except ValueError: pass
    return ranges

@lru_cache(None)
def font_path(ch):
    # Prefer DejaVu for math/Latin, CJK for Chinese; verify every glyph.
    paths=[LATIN,CJK] if ord(ch)<0x2e80 else [CJK,LATIN]
    for path in paths:
        if any(a<=ord(ch)<=b for a,b in charset(path)): return path
    raise ValueError(f'No font glyph: {ch} U+{ord(ch):04X}')

@lru_cache(None)
def font(path,size): return ImageFont.truetype(path,size)

def runs(s,size):
    result=[]
    for ch in s:
        path=font_path(ch)
        if result and result[-1][0]==path: result[-1]=(path,result[-1][1]+ch)
        else: result.append((path,ch))
    return [(font(p,size),t) for p,t in result]

def width(s,size): return sum(f.getlength(t) for f,t in runs(s,size))

class Figure:
    def __init__(self, chapter, scene):
        self.c,self.s=chapter,scene
        self.im=Image.new('RGB',(1280,720),BG); self.d=ImageDraw.Draw(self.im)
        self.texts=[]; self.bounds=[]
        self.text(56,42,f'{chapter["number"]:02d} / 12 · {chapter["title"]}',22,GREEN)
        self.text(56,102,scene['title'],36,INK)
        self.text(1224,42,scene['id'].replace('_',' / '),18,MUTED,anchor='right')
        self.d.line((56,137,1224,137),fill=LINE,width=2)
        self.d.rounded_rectangle((56,566,1224,626),radius=12,fill=WHITE,outline=LINE,width=1)
        self.text(640,604,scene['formula'],27,INK,anchor='center',maxwidth=1110)
        self.d.rectangle((56,654,61,686),fill=GREEN)
        self.text(80,680,scene['takeaway'],27,GREEN,maxwidth=1140)

    def text(self,x,y,s,size=24,color=INK,anchor='left',maxwidth=None):
        if maxwidth:
            while width(s,size)>maxwidth and size>16: size-=1
            assert width(s,size)<=maxwidth,(self.s['id'],s)
        w=width(s,size)
        if anchor=='center': x-=w/2
        if anchor=='right': x-=w
        start=x; boxes=[]
        for f,t in runs(s,size):
            b=self.d.textbbox((x,y),t,font=f,anchor='ls'); boxes.append(b)
            self.d.text((x,y),t,font=f,fill=color,anchor='ls'); x+=f.getlength(t)
        b=(min(v[0] for v in boxes),min(v[1] for v in boxes),max(v[2] for v in boxes),max(v[3] for v in boxes))
        assert b[0]>=0 and b[1]>=0 and b[2]<=1280 and b[3]<=720,(self.s['id'],s,b)
        self.texts.append(s); self.bounds.append({'text':s,'bbox':b,'size':size})

    def box(self,x,y,w,h,s,color=GREEN,fill=WHITE,size=24):
        self.d.rounded_rectangle((x,y,x+w,y+h),radius=10,fill=fill,outline=color,width=2)
        self.text(x+w/2,y+h/2+size*.34,s,size,INK,anchor='center',maxwidth=w-20)

    def arrow(self,x,y,xx,yy,color=GREEN,weight=3):
        self.d.line((x,y,xx,yy),fill=color,width=weight)
        a=math.atan2(yy-y,xx-x); l=11
        self.d.polygon([(xx,yy),(xx-l*math.cos(a-.42),yy-l*math.sin(a-.42)),(xx-l*math.cos(a+.42),yy-l*math.sin(a+.42))],fill=color)

    def notes(self,labels=None,x=808,y=213,step=73):
        for i,s in enumerate(labels or self.s['labels']):
            self.d.ellipse((x,y+i*step-20,x+8,y+i*step-12),fill=GREEN)
            self.text(x+24,y+i*step,s,24,maxwidth=1172-x)

    def flow(self,labels=None,y=292,loop=False):
        labels=labels or self.s['labels']; n=len(labels); gap=30; w=(1120-gap*(n-1))/n
        for i,s in enumerate(labels):
            x=80+i*(w+gap)
            self.box(x,y,w,76,s,COLORS[i%3],size=24)
            if i<n-1:self.arrow(x+w+5,y+38,x+w+gap-5,y+38)
        if loop:
            self.d.line((80+1120-w/2,y+76,80+1120-w/2,461,80+w/2,461,80+w/2,y+88),fill=GREEN,width=2)
            self.arrow(80+w/2,461,80+w/2,y+80)
            self.text(640,501,'反馈进入下一轮',22,MUTED,anchor='center')

    def grid(self,x,y,rows,cols,cell=36,highlight=None,color=GREEN):
        for r in range(rows):
            for c in range(cols):
                active=highlight is None or r==highlight
                fill=PALE if active else '#eef0f3'
                self.d.rectangle((x+c*cell,y+r*cell,x+(c+1)*cell-5,y+(r+1)*cell-5),fill=fill,outline=color if active else LINE)

    def axes(self,x=138,y=458,w=540,h=250):
        for i in range(1,5): self.d.line((x,y-i*h/4,x+w,y-i*h/4),fill=LINE,width=1)
        self.arrow(x,y,x+w,y,MUTED,2); self.arrow(x,y,x,y-h,MUTED,2)

    def render(self):
        getattr(self,'draw_'+self.s['visual'])()
        for value in [self.s['title'],self.s['formula'],self.s['takeaway'],*self.s['labels']]:
            assert value in self.texts,(self.s['id'],'missing',value)
        # Detect text collisions independently of the exact-string coverage check.
        overlaps=[]
        for i,a in enumerate(self.bounds):
            for b in self.bounds[i+1:]:
                x,y,xx,yy=a['bbox']; u,v,uu,vv=b['bbox']
                if min(xx,uu)>max(x,u)+2 and min(yy,vv)>max(y,v)+2: overlaps.append([a['text'],b['text']])
        assert not overlaps,(self.s['id'],'text overlap',overlaps)
        return self.im

    def draw_tokens(self):
        sid=self.s['id']; labels=self.s['labels']
        if sid=='01_01':
            self.box(110,240,210,76,labels[0],fill=PALE)
            self.box(367,240,210,76,labels[1],fill=PALE)
            self.arrow(590,278,726,278)
            for i,l in enumerate(labels[2:]): self.box(770,215+i*120,310,74,l,COLORS[i])
            self.text(344,435,'前文确定 → 下一块仍有多个候选',25,MUTED)
        elif sid in ('01_04','02_05','05_02','07_03'):
            self.text(88,238,'输入',24,MUTED); self.text(88,362,'目标',24,MUTED)
            for r,words in enumerate([['小猫','坐在','地毯'],['坐在','地毯','上']]):
                for i,t in enumerate(words):
                    x=176+i*181; self.box(x,198+r*124,145,68,t, GREEN if r==0 else BLUE)
                    if r==0:self.arrow(x+72,275,x+72,310,MUTED,2)
            self.text(420,473,'一列一道题 · 目标向后错开一位',23,MUTED,anchor='center')
            self.notes(x=790)
        elif sid=='02_02':
            self.flow(labels[:3],y=215)
            for i,t in enumerate(['a','b','a','b']):self.box(180+i*97,373,72,58,t)
            self.arrow(599,402,714,402); self.box(770,373,100,58,'ab',fill=PALE)
            self.text(989,412,labels[3],24,MUTED,anchor='center')
        elif sid=='02_03':
            for i,l in enumerate(labels[:3]):
                x=120+i*365; self.box(x,252,305,94,l,COLORS[i],size=30)
            self.text(640,445,labels[3],24,MUTED,anchor='center')
        elif sid=='11_01':
            self.flow(y=242)
            self.d.line((110,440,1170,440),fill=LINE,width=3)
            self.d.rectangle((110,427,632,452),fill=GREEN)
            for x in [690,790,890,990,1090]: self.d.rectangle((x,427,x+45,452),fill=BLUE)
            self.text(367,497,'处理整段提示',23,MUTED,anchor='center');self.text(905,497,'随后每次生成一块',23,MUTED,anchor='center')
        else: self.flow()

    def draw_bars(self):
        sid=self.s['id']; ls=self.s['labels']
        if sid=='12_01':
            for i,l in enumerate(ls):
                x=80+i*295; self.box(x,223,265,234,l,COLORS[i%3])
                for j in range(3):self.d.line((x+54,380+j*16,x+210-j*31,380+j*16),fill=COLORS[i%3],width=5)
            self.text(640,510,'多项测量共同判断 · 不合成一张万能成绩单',22,MUTED,anchor='center')
        elif sid=='09_03':
            for i,(l,n) in enumerate(zip(ls[:3],[32,16,16])):
                y=236+i*96; self.text(93,y+28,l,26)
                for b in range(n):self.d.rectangle((220+b*19,y,234+b*19,y+36),fill=COLORS[i],outline=BG)
                self.text(866,y+28,f'{n} bit',24,MUTED)
            self.text(1130,513,ls[3],24,GREEN,anchor='right')
        else:
            if sid=='01_02': vals=[.55,.25,.20]; names=ls[:3]; foot=ls[3]
            elif sid=='04_04': vals=[.665,.245,.090]; names=ls[2:]; foot=ls[0]+' → '+ls[1]
            else: vals=[.10,.28,.25,.37]; names=['地毯','窗边','桌上','其他']; foot='概率示意 · 非测量结果'
            n=len(vals)
            for i,(v,name) in enumerate(zip(vals,names)):
                x=100+i*(630/n); h=v*330
                self.d.rounded_rectangle((x,451-h,x+95,451),radius=5,fill=COLORS[i%3])
                self.text(x+48,437-h,f'{v*100:g}%',22,MUTED,anchor='center')
                self.text(x+48,493,name,23,anchor='center',maxwidth=180)
            self.d.line((86,452,746,452),fill=LINE,width=2)
            if sid=='07_01':self.notes()
            elif sid=='04_04':
                self.text(840,270,ls[0],24);self.text(840,334,ls[1],24)
            else:self.text(838,282,foot,25,MUTED)
            if sid=='07_01':self.text(420,534,foot,19,MUTED,anchor='center')

    def draw_chain(self):
        if self.s['id']=='08_02':
            ls=self.s['labels']
            self.box(92,211,255,76,ls[0]);self.box(92,365,255,76,ls[1],BLUE)
            self.arrow(357,249,533,328);self.arrow(357,403,533,328,BLUE)
            self.box(544,290,286,76,ls[2]);self.arrow(840,328,918,328)
            self.box(929,290,273,76,'L = u² = 36')
            self.text(672,477,ls[3],24,GREEN,anchor='center')
            self.text(672,523,'沿路径：dL/dw = 2u × 3',24,MUTED,anchor='center')
        elif self.s['id']=='10_04':
            ls=self.s['labels']
            self.box(86,282,245,82,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:3]):
                y=207+i*164;self.arrow(342,323,480,y+39,COLORS[i],2)
                self.box(491,y,280,78,l,COLORS[i]);self.arrow(782,y+39,920,323,COLORS[i],2)
            self.box(931,282,265,82,ls[3])
            self.d.line((1064,374,1064,491,209,491,209,380),fill=GREEN,width=2)
            self.arrow(209,423,209,371)
            self.text(640,538,'奖励推动改进 · 参考模型约束偏移',23,MUTED,anchor='center')
        else:self.flow(loop=self.s['id'] in ('01_03','09_01'))

    def draw_roadmap(self):
        ls=self.s['labels']; n=len(ls)
        self.d.line((153,300,1127,300),fill=LINE,width=4)
        for i,l in enumerate(ls):
            x=153+i*974/(n-1)
            self.d.ellipse((x-33,267,x+33,333),fill=PALE,outline=GREEN,width=2)
            self.text(x,311,f'{i+1:02d}',24,GREEN,anchor='center')
            self.text(x,398,l,25,anchor='center',maxwidth=230)

    def draw_recap(self):
        ls=self.s['labels']
        if self.s['id'] in ('05_06','12_05'):
            self.flow(y=282)
            self.text(640,470,'按计算发生的顺序，把各环节接起来',24,MUTED,anchor='center')
            return
        self.box(82,277,266,98,ls[0],fill=PALE)
        for i,l in enumerate(ls[1:]):
            y=185+i*123
            self.arrow(357,326,811,y+39,COLORS[i],2)
            self.box(821,y,367,78,l,COLORS[i])

    def draw_data(self):
        sid=self.s['id']; ls=self.s['labels']
        if sid=='12_02':
            for i,l in enumerate(ls[:3]):
                x=92+i*390; self.box(x,216,312,270,l,COLORS[i])
                self.grid(x+51,369,2,5,42,color=COLORS[i])
            self.text(640,533,ls[3],24,MUTED,anchor='center')
        elif sid=='09_02':
            for i,l in enumerate(ls[:2]):
                self.box(90,215+i*158,270,88,l,BLUE);self.arrow(370,259+i*158,565,338)
            self.box(572,294,264,88,ls[2],fill=PALE);self.arrow(845,338,912,338);self.box(920,294,282,88,ls[3])
            self.text(640,506,'先累积多个微批次的梯度，再执行一次更新',23,MUTED,anchor='center')
        elif sid=='02_06':
            for r in range(3):
                for c in range(4):self.box(95+c*141,214+r*83,118,58,'屏蔽' if r==2 and c>1 else f'{r+1},{c+1}',LINE if r==2 and c>1 else GREEN,size=22)
            self.notes()
        else:
            self.flow(y=306)
            for i in range(4):
                x=147+i*290
                self.d.rounded_rectangle((x,192,x+64,267),radius=5,fill=WHITE,outline=LINE,width=2)
                for j in range(3):self.d.line((x+12,211+j*14,x+51,211+j*14),fill=GREEN,width=2)

    def draw_matrix(self):
        sid=self.s['id']; ls=self.s['labels']
        if sid=='02_04':
            self.box(94,299,180,74,'id = 17',fill=PALE)
            self.arrow(286,336,354,336);self.grid(376,208,6,5,48,highlight=2)
            self.text(495,192,'Embedding E',23,MUTED,anchor='center');self.notes()
        elif sid=='11_06':
            self.grid(123,240,5,5,45);self.text(235,210,'W（冻结）',23,anchor='center')
            self.text(394,370,'+',38,GREEN);self.grid(475,240,5,2,45,color=BLUE)
            self.text(604,370,'×',36,MUTED);self.grid(664,288,2,5,45,color=BLUE)
            self.text(583,500,'BA：低秩增量',23,MUTED,anchor='center');self.notes(x=948,y=226,step=71)
        elif sid=='08_03':
            for i,(x,r,c,t) in enumerate([(105,4,3,'X'),(336,3,2,'W'),(565,4,2,'Y')]):
                self.grid(x,232,r,c,37,color=COLORS[i]);self.text(x+c*18,207,t,25,anchor='center')
            self.text(261,315,'×',30);self.text(479,315,'=',30)
            self.arrow(670,437,140,437,BLUE)
            self.text(406,493,'Xᵀ × 上游梯度 → W 的梯度',23,MUTED,anchor='center')
            self.notes(x=827)
        else:
            shapes=[(4,3),(3,2),(4,2)] if sid=='03_04' else [(4,3),(3,6),(4,6)]
            xs=[98,359,635]
            for i,(r,c) in enumerate(shapes):
                self.grid(xs[i],242,r,c,30,color=COLORS[i]); self.text(xs[i]+c*15,214,['X','W','Y' if sid=='03_04' else 'Z'][i],25,COLORS[i],anchor='center')
            self.text(276,313,'×',34);self.text(535,313,'=',34)
            self.text(435,450,'内侧维度匹配 → 保留外侧维度',23,MUTED,anchor='center')
            self.notes(x=928,y=221,step=72)

    def draw_vectors(self):
        sid=self.s['id']; origin=(245,453); unit=100
        for k in range(4):
            self.d.line((145+k*100,173,145+k*100,493),fill=LINE)
            self.d.line((145,453-k*100,685,453-k*100),fill=LINE)
        self.arrow(145,453,699,453,MUTED,2);self.arrow(245,496,245,169,MUTED,2)
        if sid=='03_01': vectors=[(2,1)]; tags=['(2,1)']
        elif sid=='03_02':vectors=[(2,0),(0,2),(1.5,.5)];tags=['A','B','混合']
        elif sid=='03_03':vectors=[(1,2),(3,1)];tags=['q','k']
        else:vectors=[(2,0),(0,2),(1,1),(1.42,.58)];tags=['V₁','V₂','V₃','混合']
        for i,((x,y),t) in enumerate(zip(vectors,tags)):
            xx=245+x*100; yy=453-y*100
            self.arrow(245,453,xx,yy,COLORS[i%3],4)
            self.text(xx+12,yy-15,t,21,COLORS[i%3])
        self.notes()
        if sid=='04_05':self.text(465,532,'≈ (1.42, 0.58)',23,GREEN,anchor='center')

    def draw_network(self):
        sid=self.s['id']; ls=self.s['labels']
        if sid=='03_06':
            for i in range(2):
                x=116+i*550; self.axes(x,448,430,240)
                pts=[(x+20,448),(x+190,448),(x+410,218)] if i else [(x+20,448),(x+410,218)]
                self.d.line(pts,fill=GREEN,width=4)
                self.text(x+220,199,ls[i*2],24,anchor='center');self.text(x+220,514,ls[i*2+1],24,anchor='center')
        elif sid=='04_02':
            self.box(92,288,240,84,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:]):
                y=190+i*115;self.arrow(343,330,663,y+34,COLORS[i],2);self.box(674,y,430,69,l,COLORS[i])
        elif sid=='12_04':
            self.box(88,291,238,82,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:3]):
                y=207+i*164;self.arrow(337,332,482,y+39,COLORS[i],2)
                self.box(493,y,254,78,l,COLORS[i]);self.arrow(758,y+39,922,332,COLORS[i],2)
            self.box(933,291,265,82,'组合输出')
            self.text(640,510,ls[3],24,MUTED,anchor='center')
        elif sid=='11_05':
            self.box(76,289,223,78,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:3]):
                y=207+i*160;self.arrow(310,328,426,y+37,COLORS[i],2)
                self.box(437,y,265,74,l,COLORS[i]);self.arrow(713,y+37,839,328,COLORS[i],2)
            self.box(850,289,350,78,ls[3])
            self.text(640,515,'问题 + 外部依据 → 生成有依据的回答',24,MUTED,anchor='center')
        elif sid=='06_02':
            self.box(80,279,164,72,'X：N×d',size=22)
            for i,t in enumerate(['SiLU(XWg)','XWu']):
                y=200+i*167;self.arrow(255,315,367,y+35,COLORS[i],2)
                self.box(378,y,265,70,t,COLORS[i]);self.arrow(654,y+35,752,315,COLORS[i],2)
            self.box(763,279,90,72,'⊙',size=34);self.arrow(864,315,928,315)
            self.box(939,279,263,72,'× Wd → N×d',size=23)
            for i,l in enumerate(ls):self.text([169,509,808,1080][i],503,l,23,anchor='center',maxwidth=264)
        elif sid=='06_04':
            self.flow(['X₀','Block₁','Block₂','Xᴸ'],y=215)
            for i,l in enumerate(ls):self.text(220+i*287,439,l,23,anchor='center',maxwidth=275)
        elif sid=='09_04':
            for i,l in enumerate(ls[:3]):
                x=85+i*396;self.text(x+158,211,l,25,anchor='center')
                for j in range(3):
                    y=242+j*83
                    self.box(x,y,316,62,(['完整模型 · 数据 '+str(j+1), '同一层的分片 '+str(j+1), '阶段 '+str(j+1)])[i],COLORS[i],size=22)
                    if i==2 and j<2:self.arrow(x+158,y+64,x+158,y+81,AMBER,2)
            self.text(640,530,ls[3],24,MUTED,anchor='center')
        else:
            columns=[(130,3),(420,4),(730,4),(1080,2)]
            for (x,n),(xx,nn) in zip(columns,columns[1:]):
                for a in range(n):
                    for b in range(nn):self.d.line((x,330+(a-(n-1)/2)*53,xx,330+(b-(nn-1)/2)*53),fill=LINE,width=2)
            for i,(x,n) in enumerate(columns):
                for a in range(n):self.d.ellipse((x-10,320+(a-(n-1)/2)*53,x+10,340+(a-(n-1)/2)*53),fill=COLORS[i%3])
                self.text(x,501,ls[i],23,anchor='center',maxwidth=235)

    def draw_attention(self):
        sid=self.s['id']; ls=self.s['labels']
        if sid=='04_01':
            for i,l in enumerate(ls[:4]):self.box(98+i*296,203,202,68,l,fill=PALE if i==3 else WHITE)
            for i,w in enumerate([6,3,2]):
                self.d.line((1087,279,1087,361+i*37,199+i*296,361+i*37,199+i*296,282),fill=COLORS[i],width=w)
                self.arrow(199+i*296,339+i*37,199+i*296,277,COLORS[i],w)
            self.text(640,506,ls[4],24,MUTED,anchor='center')
        elif sid=='05_03':
            self.box(77,301,232,75,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:3]):
                y=219+i*158;self.arrow(319,338,454,y+35,COLORS[i],2);self.box(465,y,258,70,l,COLORS[i]);self.arrow(734,y+35,904,338,COLORS[i],2)
            self.box(915,301,288,75,ls[3])
        elif sid=='11_02':
            self.grid(99,222,2,9,48);self.box(596,222,140,90,'新 K/V',BLUE)
            self.arrow(583,268,546,268,BLUE);self.arrow(313,332,313,413)
            self.box(125,430,503,66,'本轮查询读取历史键和值',size=23);self.notes(x=831)
        else:
            self.flow(y=302)
            self.text(640,228,'先做点积，再按查询 / 键的维度缩放',25,MUTED,anchor='center')

    def draw_mask(self):
        if self.s['id']=='10_02':
            for i,t in enumerate(['用户','提问','助手','回答']):self.box(260+i*149,200,125,56,t,BLUE if i<2 else GREEN,size=22)
            self.text(86,300,'计分',23,MUTED);self.text(86,431,'可见性',23,MUTED)
            for i in range(4):self.box(260+i*149,273,125,52,'0' if i<2 else '1',BLUE if i<2 else GREEN,size=25)
            self.grid(359,349,4,4,39)
            for r in range(4):
                for c in range(4):
                    self.d.rectangle((359+c*39,349+r*39,392+c*39,382+r*39),fill=PALE if c<=r else '#eef0f3',outline=LINE)
                    self.text(375+c*39,374+r*39,'✓' if c<=r else '×',20,GREEN if c<=r else MUTED,anchor='center')
            self.notes(x=930,y=231,step=79)
        else:
            words=['小猫','坐','在','地毯']; cell=66; x=241;y=232
            self.text(370,178,'列：可读取的位置',22,MUTED,anchor='center')
            for i,w in enumerate(words):
                self.text(x+i*cell+30,214,w,22,anchor='center');self.text(214,y+i*cell+43,w,22,MUTED,anchor='right')
                for j in range(4):
                    self.d.rectangle((x+j*cell,y+i*cell,x+j*cell+58,y+i*cell+58),fill=PALE if j<=i else '#eef0f3',outline=GREEN if j<=i else LINE)
                    self.text(x+j*cell+29,y+i*cell+41,'✓' if j<=i else '×',30,GREEN if j<=i else MUTED,anchor='center')
            self.notes(x=715,y=218,step=62)
            self.text(739,511,'未来：加 −∞ → softmax 后为 0',24,GREEN,maxwidth=451)

    def draw_position(self):
        for i,(x,angle) in enumerate([(286,.6),(665,1.2)]):
            y=334;r=116;self.d.ellipse((x-r,y-r,x+r,y+r),outline=LINE,width=2)
            self.d.line((x-r-17,y,x+r+17,y),fill=LINE,width=2)
            self.arrow(x,y,x+94,y,BLUE);self.arrow(x,y,x+105*math.cos(angle),y-105*math.sin(angle),GREEN,4)
            self.d.arc((x-48,y-48,x+48,y+48),start=-angle*180/math.pi,end=0,fill=AMBER,width=3)
            self.text(x,511,self.s['labels'][i],24,anchor='center')
        self.notes(self.s['labels'][2:],x=925,y=289,step=94)

    def draw_scale(self):
        if self.s['id']=='05_05':
            self.grid(101,307,4,4,33);self.grid(320,221,8,8,33,color=BLUE)
            self.text(165,490,'N²',27,GREEN,anchor='center');self.text(452,526,'4N²',27,BLUE,anchor='center')
            self.arrow(245,371,300,371);self.notes(x=804)
        else:
            ls=self.s['labels']
            for i,l in enumerate(ls):
                y=219+i*83;self.text(133,y+12,l,25)
                self.d.line((351,y,1118,y),fill=LINE,width=6)
                self.d.ellipse((650+i*45,y-9,668+i*45,y+9),fill=GREEN)
            self.text(640,542,'共同分配资源 · 滑杆位置仅示意',20,MUTED,anchor='center')

    def draw_block(self):
        # One pre-normalized residual sublayer, then another: neither skips the addition.
        ls=self.s['labels']
        self.box(76,310,130,72,'X',fill=PALE)
        self.box(292,310,221,72,'Norm → Attn',size=23)
        self.box(595,310,80,72,'+',size=31)
        self.box(764,310,223,72,'Norm → FFN',size=23)
        self.box(1074,310,90,72,'+',size=31)
        for x,xx in [(214,283),(521,586),(683,755),(995,1065)]:self.arrow(x,346,xx,346)
        for x,xx in [(242,635),(715,1119)]:
            self.d.line((x,346,x,232,xx,232,xx,297),fill=GREEN,width=3);self.arrow(xx,270,xx,303)
        self.text(421,204,'保留主路',22,GREEN,anchor='center');self.text(917,204,'保留主路',22,GREEN,anchor='center')
        for i,l in enumerate(ls):self.text(210+i*292,492,l,24,anchor='center',maxwidth=278)

    def draw_code(self):
        ls=self.s['labels']
        if self.s['id']=='06_06':code=['x = embed(ids)','x = blocks(x)','z = project(norm(x))','prediction = select(z)']
        else:code=['sample_answer()','verify_result()','compute_reward()','check_for_loopholes()']
        self.d.rounded_rectangle((80,179,1200,526),radius=12,fill=WHITE,outline=LINE,width=2)
        for i,(c,l) in enumerate(zip(code,ls)):
            y=240+i*78;self.text(108,y,f'{i+1:02d}',20,MUTED);self.text(170,y,c,27,GREEN,maxwidth=600);self.text(839,y,l,24,maxwidth=325)

    def draw_loss(self):
        sid=self.s['id'];self.axes(126,452,579,248)
        if sid=='07_02':
            pts=[(126+p*579,452-(-math.log(p))/3*225) for p in [i/100 for i in range(5,101)]]
            self.d.line(pts,fill=GREEN,width=4)
            self.text(673,493,'p',23,MUTED);self.text(93,203,'L',23,MUTED)
            for p in [.1,.5,.9]:
                x=126+p*579;y=452-(-math.log(p))/3*225;self.d.ellipse((x-5,y-5,x+5,y+5),fill=BLUE)
            self.notes()
        else:
            pts=[(126+i*5.79,452-(185*math.exp(-i/30)+23)) for i in range(101)]
            self.d.line(pts,fill=GREEN,width=4)
            if sid=='09_05':
                pts=[(126+i*5.79,452-(145*math.exp(-i/23)+62+max(0,i-55)**2*.05)) for i in range(101)]
                self.d.line(pts,fill=BLUE,width=4)
            self.text(415,513,'训练步数 · 曲线仅示意',21,MUTED,anchor='center');self.text(93,202,'L',23,MUTED)
            self.notes()
            if sid=='09_05':
                self.text(622,440,'训练',18,GREEN);self.text(622,318,'验证',18,BLUE)

    def draw_gradient(self):
        if self.s['id']=='07_04':
            for i,(name,g) in enumerate([('目标词', 'p − 1 < 0'),('其他词','p > 0')]):
                x=112+i*334;self.box(x,211,269,72,name,COLORS[i]);self.text(x+134,349,g,28,COLORS[i],anchor='center')
                self.arrow(x+135,430,x+135,380 if i==0 else 486,COLORS[i],4)
            self.notes(x=845)
        else:
            self.axes(119,466,573,245)
            pts=[(119+i*5.7,457-((i-52)/52)**2*226) for i in range(101)]
            self.d.line(pts,fill=GREEN,width=4);self.arrow(241,323,331,425,BLUE,4)
            self.text(661,507,'参数',22,MUTED);self.text(81,207,'L',22,MUTED);self.notes()

    def draw_optimizer(self):
        if self.s['id']=='08_04':
            self.flow(y=259);self.text(640,465,'先算出 g，再由学习率 η 控制参数移动',25,MUTED,anchor='center')
        else:
            ls=self.s['labels']
            for i,l in enumerate(ls[:2]):self.box(102,206+i*133,371,80,l,COLORS[i])
            self.arrow(484,246,641,338);self.arrow(484,379,641,338,BLUE)
            self.box(651,298,239,80,ls[2]);self.arrow(901,338,971,338);self.box(981,281,230,114,ls[3],AMBER)
            self.text(640,501,'历史状态调节步幅 · 权重衰减单独执行',24,MUTED,anchor='center')

    def draw_preference(self):
        ls=self.s['labels'];sid=self.s['id']
        if sid=='12_03':
            self.flow(y=283);self.text(640,474,'保持其他条件一致，才更容易定位变化的原因',24,MUTED,anchor='center')
        elif sid=='10_05':
            self.box(77,284,237,89,ls[0],fill=PALE)
            for i,l in enumerate(ls[1:3]):
                y=202+i*168;self.arrow(325,328,452,y+38,COLORS[i],2);self.box(463,y,260,76,l,COLORS[i]);self.arrow(734,y+38,903,328,COLORS[i],2)
            self.box(914,284,286,89,ls[3]);self.text(640,524,'比较相对参考模型的偏好间距',23,MUTED,anchor='center')
        else:
            for i,l in enumerate(ls[:2]):self.box(94,218+i*156,295,91,l,COLORS[i])
            self.arrow(400,263,581,339);self.arrow(400,419,581,339,BLUE)
            self.box(592,300,256,78,ls[2]);self.arrow(859,339,913,339);self.box(924,300,280,78,ls[3])

    def draw_sampling(self):
        self.flow(y=201)
        for i,(t,title) in enumerate([(.5,'低温：更集中'),(1.5,'高温：更分散')]):
            x=203+i*620;z=[2/t,1/t,0];p=[math.exp(v)/sum(math.exp(u) for u in z) for v in z]
            for j,v in enumerate(p):self.d.rectangle((x+j*78,482-v*159,x+j*78+46,482),fill=COLORS[j])
            self.text(x+106,531,title,23,MUTED,anchor='center')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-dir',type=Path,default=Path('/workspace/hhh-redesign-shots'))
    args=parser.parse_args(); review=args.review_dir;review.mkdir(parents=True,exist_ok=True)
    backup=review/'figures-old';backup.mkdir(exist_ok=True)
    target=ROOT/'public/course/figures';target.mkdir(parents=True,exist_ok=True)
    chapters=json.loads((ROOT/'lib/academy/original.json').read_text())['chapters']
    manifest=[];all_images=[];pairs=[]
    for c in chapters:
        for scene in c['scenes']:
            path=target/(scene['id']+'.webp');old=backup/path.name
            if path.exists() and not old.exists():shutil.copy2(path,old)
            f=Figure(c,scene);im=f.render();im.save(path,'WEBP',quality=94,method=6)
            assert Image.open(path).size==(1280,720)
            manifest.append({'id':scene['id'],'visual':scene['visual'],'labelsVerified':len(scene['labels']),
                             'size':[1280,720],'missingGlyphs':0,'textOverlaps':0,'renderedText':f.bounds})
            all_images.append((scene['id'],im.copy()))
            if scene['id'].endswith('_01'):
                pairs.append((scene['id'],Image.open(old).convert('RGB') if old.exists() else im.copy(),im.copy()))
    assert len(manifest)==72
    sheet=Image.new('RGB',(1280,12*390),WHITE);d=ImageDraw.Draw(sheet)
    for i,(sid,old,new) in enumerate(pairs):
        y=i*390;d.text((16,y+5),sid+'  OLD',font=font(LATIN,18),fill=INK);d.text((656,y+5),sid+'  NEW',font=font(LATIN,18),fill=INK)
        sheet.paste(old.resize((640,360),Image.Resampling.LANCZOS),(0,y+30));sheet.paste(new.resize((640,360),Image.Resampling.LANCZOS),(640,y+30))
    sheet.save(review/'figures-contact.png')
    sheet=Image.new('RGB',(6*426,12*264),WHITE);d=ImageDraw.Draw(sheet)
    for i,(sid,im) in enumerate(all_images):
        x=i%6*426;y=i//6*264;d.text((x+7,y+3),sid,font=font(LATIN,16),fill=INK)
        sheet.paste(im.resize((426,240),Image.Resampling.LANCZOS),(x,y+24))
    sheet.save(review/'figures-all-new.png')
    (review/'figures-text-audit.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Rendered and verified {len(manifest)} figures; {sum(m["labelsVerified"] for m in manifest)} exact source labels; no missing glyphs, out-of-bounds text or overlapping text.')
    print(f'Review files: {review}')

if __name__=='__main__':main()
