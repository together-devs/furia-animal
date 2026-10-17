import sys,io,os
from PIL import Image, ImageOps
from rembg import remove, new_session
src,slug,flip=sys.argv[1],sys.argv[2],sys.argv[3]=='1'
sess=new_session("isnet-general-use")
im=Image.open(src).convert("RGB")
out=remove(im,session=sess,alpha_matting=True,alpha_matting_foreground_threshold=240,alpha_matting_background_threshold=15).convert("RGBA")
a=out.split()[-1].point(lambda v:0 if v<40 else v); out.putalpha(a)
bb=out.getbbox(); out=out.crop(bb)
if flip: out=ImageOps.mirror(out)
side=int(max(out.size)*1.04); c=Image.new("RGBA",(side,side),(0,0,0,0))
c.paste(out,((side-out.width)//2,side-out.height-int(side*.02)),out)
c.resize((384,384),Image.LANCZOS).save(f"/home/claude/furia-animal/img/{slug}.webp","WEBP",quality=88,method=6)
print("ok",os.path.getsize(f"/home/claude/furia-animal/img/{slug}.webp"))
