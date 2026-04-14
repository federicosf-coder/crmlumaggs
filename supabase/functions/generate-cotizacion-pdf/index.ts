import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documento_id } = await req.json();
    if (!documento_id) throw new Error("documento_id requerido");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch document
    const { data: doc, error: docErr } = await sb
      .from("documentos")
      .select("*, companies(name, address, city, state, zip_code, phone, email), contacts(first_name, last_name, email, phone)")
      .eq("id", documento_id)
      .single();
    if (docErr || !doc) throw new Error("Documento no encontrado");

    // Fetch line items
    const { data: items = [] } = await sb
      .from("documento_productos")
      .select("*, productos(codigo, nombre_producto, presentaciones(nombre))")
      .eq("documento_id", documento_id);

    // Fetch commercial conditions
    const { data: condiciones } = await sb
      .from("condiciones_comerciales")
      .select("contenido")
      .eq("empresa_vendedora", doc.empresa_vendedora)
      .single();

    // Fetch executive name
    let ejecutivoName = "";
    if (doc.ejecutivo_venta_id) {
      const { data: prof } = await sb
        .from("profiles")
        .select("full_name")
        .eq("user_id", doc.ejecutivo_venta_id)
        .single();
      ejecutivoName = prof?.full_name || "";
    }

    // Fetch logo
    const logoKey = doc.empresa_vendedora === "lumaggs_chevron" ? "lumaggs_chevron" : "galsa_phillips66";
    const { data: logoData } = await sb
      .from("brand_logos")
      .select("storage_path")
      .eq("key", logoKey)
      .single();

    // Brand colors
    const isLumaggs = doc.empresa_vendedora === "lumaggs_chevron";
    const brandColor = isLumaggs ? rgb(0.05, 0.25, 0.56) : rgb(0.72, 0.11, 0.11);
    const brandColorLight = isLumaggs ? rgb(0.85, 0.9, 0.97) : rgb(0.97, 0.88, 0.88);
    const empresaLabel = isLumaggs ? "Lumaggs Chevron" : "Galsa Phillips 66";

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (text: string, x: number, yPos: number, size = 10, f = font, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x, y: yPos, size, font: f, color });
    };

    const drawLine = (x1: number, y1: number, x2: number, thickness = 1, color = rgb(0.8, 0.8, 0.8)) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color });
    };

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    // ===== HEADER =====
    // Brand bar
    page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: brandColor });

    // Title
    drawText("COTIZACIÓN", margin, y - 20, 22, fontBold, brandColor);
    y -= 25;

    // Empresa vendedora
    drawText(empresaLabel, margin, y - 20, 11, fontBold, brandColor);
    y -= 35;

    // Number and date
    const numCot = doc.numero_cotizacion || "Sin número";
    const fecha = doc.fecha_documento || "";
    const fechaVenc = doc.fecha_vencimiento || "";

    drawText("No. Cotización:", margin, y, 9, fontBold);
    drawText(numCot, margin + 85, y, 9);
    drawText("Fecha:", pageWidth / 2, y, 9, fontBold);
    drawText(fecha, pageWidth / 2 + 40, y, 9);
    y -= 14;

    if (fechaVenc) {
      drawText("Vigencia:", margin, y, 9, fontBold);
      drawText(fechaVenc, margin + 55, y, 9);
      y -= 14;
    }

    if (ejecutivoName) {
      drawText("Ejecutivo:", margin, y, 9, fontBold);
      drawText(ejecutivoName, margin + 58, y, 9);
      y -= 14;
    }

    y -= 10;
    drawLine(margin, y, pageWidth - margin, 1, brandColor);
    y -= 20;

    // ===== CLIENT INFO =====
    const company = doc.companies as any;
    const contact = doc.contacts as any;

    drawText("DATOS DEL CLIENTE", margin, y, 11, fontBold, brandColor);
    y -= 16;

    if (company?.name) { drawText("Empresa:", margin, y, 9, fontBold); drawText(company.name, margin + 55, y, 9); y -= 13; }
    if (contact) {
      const contactName = `${contact.first_name} ${contact.last_name}`;
      drawText("Contacto:", margin, y, 9, fontBold); drawText(contactName, margin + 55, y, 9); y -= 13;
      if (contact.email) { drawText("Email:", margin, y, 9, fontBold); drawText(contact.email, margin + 55, y, 9); y -= 13; }
      if (contact.phone) { drawText("Tel:", margin, y, 9, fontBold); drawText(contact.phone, margin + 55, y, 9); y -= 13; }
    }
    if (company?.address) { drawText("Dirección:", margin, y, 9, fontBold); drawText(`${company.address}${company.city ? ', ' + company.city : ''}${company.state ? ', ' + company.state : ''}`, margin + 55, y, 9); y -= 13; }
    if (doc.direccion_envio) { drawText("Envío:", margin, y, 9, fontBold); drawText(doc.direccion_envio, margin + 55, y, 9); y -= 13; }

    y -= 10;

    // ===== PRODUCTS TABLE =====
    addNewPageIfNeeded(60);
    drawText("PRODUCTOS", margin, y, 11, fontBold, brandColor);
    y -= 18;

    // Table header
    const colX = [margin, margin + 40, margin + 260, margin + 310, margin + 370, margin + 430, margin + 480];
    const colLabels = ["#", "Descripción", "Cant.", "P. Unit.", "Desc. %", "Subtotal"];

    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 18, color: brandColor });
    colLabels.forEach((label, i) => {
      drawText(label, colX[i] + 3, y, 8, fontBold, rgb(1, 1, 1));
    });
    y -= 18;

    // Table rows
    (items || []).forEach((item: any, idx: number) => {
      addNewPageIfNeeded(16);
      const prod = item.productos;
      const desc = [prod?.codigo, prod?.nombre_producto, (prod?.presentaciones as any)?.nombre].filter(Boolean).join(" ");
      const bgColor = idx % 2 === 0 ? brandColorLight : rgb(1, 1, 1);

      page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 16, color: bgColor });

      drawText(String(idx + 1), colX[0] + 3, y, 8);
      // Truncate description if too long
      const maxDescLen = 38;
      const descTrunc = desc.length > maxDescLen ? desc.substring(0, maxDescLen) + "..." : desc;
      drawText(descTrunc, colX[1] + 3, y, 8);
      drawText(String(item.cantidad), colX[2] + 3, y, 8);
      drawText(`$${Number(item.precio_unitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, colX[3] + 3, y, 8);
      drawText(`${item.descuento_porcentaje}%`, colX[4] + 3, y, 8);
      drawText(`$${Number(item.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, colX[5] + 3, y, 8);
      y -= 16;
    });

    // Totals
    y -= 8;
    addNewPageIfNeeded(60);
    const totalsX = pageWidth - margin - 160;

    drawText("Subtotal:", totalsX, y, 9, fontBold);
    drawText(`$${Number(doc.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, totalsX + 80, y, 9);
    y -= 14;

    drawText(`IVA (${doc.iva_porcentaje}%):`, totalsX, y, 9, fontBold);
    drawText(`$${Number(doc.iva_importe).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, totalsX + 80, y, 9);
    y -= 14;

    drawLine(totalsX, y + 4, pageWidth - margin, 1, brandColor);
    drawText("TOTAL:", totalsX, y - 6, 12, fontBold, brandColor);
    drawText(`$${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, totalsX + 80, y - 6, 12, fontBold, brandColor);
    y -= 30;

    // ===== NOTES =====
    if (doc.notas) {
      addNewPageIfNeeded(40);
      drawText("NOTAS", margin, y, 11, fontBold, brandColor);
      y -= 16;
      // Word wrap notes
      const words = doc.notas.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(test, 9) > contentWidth) {
          addNewPageIfNeeded(14);
          drawText(line, margin, y, 9);
          y -= 13;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) { addNewPageIfNeeded(14); drawText(line, margin, y, 9); y -= 13; }
      y -= 10;
    }

    // ===== COMMERCIAL CONDITIONS =====
    if (condiciones?.contenido) {
      addNewPageIfNeeded(40);
      drawLine(margin, y, pageWidth - margin, 1, brandColor);
      y -= 20;
      drawText("CONDICIONES COMERCIALES", margin, y, 11, fontBold, brandColor);
      y -= 16;

      const condWords = condiciones.contenido.split(" ");
      let condLine = "";
      for (const word of condWords) {
        const test = condLine ? condLine + " " + word : word;
        if (font.widthOfTextAtSize(test, 8) > contentWidth) {
          addNewPageIfNeeded(13);
          drawText(condLine, margin, y, 8, font, rgb(0.3, 0.3, 0.3));
          y -= 12;
          condLine = word;
        } else {
          condLine = test;
        }
      }
      if (condLine) { addNewPageIfNeeded(13); drawText(condLine, margin, y, 8, font, rgb(0.3, 0.3, 0.3)); y -= 12; }
    }

    // ===== FOOTER =====
    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const p = pdfDoc.getPage(i);
      p.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 30, color: brandColor });
      p.drawText(empresaLabel, { x: margin, y: 10, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      p.drawText(`Página ${i + 1} de ${totalPages}`, { x: pageWidth - margin - 70, y: 10, size: 8, font, color: rgb(1, 1, 1) });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Cotizacion_${doc.numero_cotizacion || doc.id}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
