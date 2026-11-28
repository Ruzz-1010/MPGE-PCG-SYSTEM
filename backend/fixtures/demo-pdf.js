// Minimal synthetic one-page PDF with computed xref offsets; no personal data.
export function demoPdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>','<< /Length 4 >>\nstream\nq\nQ\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];
 objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});
 const xref=Buffer.byteLength(pdf);
 pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n';
 for(const o of offsets.slice(1))pdf+=String(o).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(pdf);
}
