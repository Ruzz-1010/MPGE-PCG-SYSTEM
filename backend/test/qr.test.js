import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
test('QR encoder and local image decoder round trip an opaque fixture',()=>{
 const payload='VW1:00000000-0000-4000-8000-000000000001';
 const matrix=QRCode.create(payload,{errorCorrectionLevel:'M'}).modules;
 const quiet=4,scale=8,w=(matrix.size+quiet*2)*scale;
 const image=new Uint8ClampedArray(w*w*4).fill(255);
 for(let r=0;r<matrix.size;r++)for(let c=0;c<matrix.size;c++)if(matrix.get(r,c))
 for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){const p=((r+quiet)*scale+y)*w*4+((c+quiet)*scale+x)*4;image[p]=image[p+1]=image[p+2]=0;}
 assert.equal(jsQR(image,w,w)?.data,payload);
});
