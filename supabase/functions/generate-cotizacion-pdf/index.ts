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
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documento_id } = await req.json();
    if (!documento_id) throw new Error("documento_id requerido");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch document
    const { data: doc, error: docErr } = await sb
      .from("documentos")
      .select("*, companies(name, razon_social, address, city, state, zip_code, phone, email), contacts(first_name, last_name, email, phone, whatsapp_phone)")
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

    // Fetch executive info
    let ejecutivoName = "";
    let ejecutivoEmail = "";
    let ejecutivoPhone = "";
    if (doc.ejecutivo_venta_id) {
      const { data: prof } = await sb
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", doc.ejecutivo_venta_id)
        .single();
      ejecutivoName = prof?.full_name || "";
      ejecutivoEmail = prof?.email || "";
      ejecutivoPhone = prof?.phone || "";
    }

    // Fetch logo - keys in DB are "lumaggs" and "phillips66"
    const isLumaggs = doc.empresa_vendedora === "lumaggs_chevron";
    const logoKey = isLumaggs ? "lumaggs" : "phillips66";
    const { data: logoData } = await sb
      .from("brand_logos")
      .select("storage_path")
      .eq("key", logoKey)
      .single();

    console.log("Logo lookup:", logoKey, "found:", logoData?.storage_path);

    // Lumaggs = blue, Galsa = dark red/maroon for Phillips 66
    const headerColor = isLumaggs ? rgb(0.22, 0.33, 0.73) : rgb(0.80, 0.12, 0.18);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const rightEdge = pageWidth - margin;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const fontSize = 9; // consistent size for the whole document

    // Sanitiza texto para las fuentes estandar (WinAnsi): quita saltos de linea,
    // tabuladores y caracteres no codificables (emojis, etc.)
    const sanitize = (text: unknown): string =>
      String(text ?? "")
        .replace(/[\r\n\t\v\f]+/g, " ")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "");

    const drawText = (text: string, x: number, yPos: number, size = fontSize, f = font, color = rgb(0, 0, 0)) => {
      page.drawText(sanitize(text), { x, y: yPos, size, font: f, color });
    };

    // Word-wrap text within a max width, returns lines
    const wrapText = (text: string, maxWidth: number, size = fontSize, f = font): string[] => {
      const words = sanitize(text).split(" ");

      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? current + " " + word : word;
        if (f.widthOfTextAtSize(test, size) > maxWidth) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines.length ? lines : [""];
    };

    const drawTextRight = (text: string, xRight: number, yPos: number, size = fontSize, f = font, color = rgb(0, 0, 0)) => {
      const t = sanitize(text);
      const w = f.widthOfTextAtSize(t, size);
      page.drawText(t, { x: xRight - w, y: yPos, size, font: f, color });
    };

    const drawLine = (x1: number, y1: number, x2: number, thickness = 0.5, color = rgb(0.7, 0.7, 0.7)) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y1 }, thickness, color });
    };

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const fmtMoney = (n: number) => {
      return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ===== LOGO (top-left, large) =====
    let logoBottomY = y;
    if (logoData?.storage_path) {
      try {
        const { data: logoFile } = await sb.storage.from("logos").download(logoData.storage_path);
        if (logoFile) {
          const logoBytes = new Uint8Array(await logoFile.arrayBuffer());
          let logoImage;
          try { logoImage = await pdfDoc.embedPng(logoBytes); } catch { logoImage = await pdfDoc.embedJpg(logoBytes); }
          const logoAspect = logoImage.width / logoImage.height;
          const logoH = 65;
          const logoW = logoH * logoAspect;
          page.drawImage(logoImage, { x: margin, y: y - logoH, width: logoW, height: logoH });
          logoBottomY = y - logoH - 53; // ~1cm extra spacing below logo
        }
      } catch (e) { console.error("Logo embed error:", e); }
    } else {
      console.error("No logo storage_path found for key:", logoKey);
    }

    y = logoBottomY;

    // ===== COMPANY NAME right-aligned =====
    const companyLabel = isLumaggs ? "Lumaggs" : "Galsa";
    drawTextRight(companyLabel, rightEdge, y + 65, 12, fontBold, rgb(0, 0, 0));

    // ===== PROPOSAL INFO (left) + COMPANY CONTACT (right) =====
    const numCot = doc.numero_cotizacion || "Sin numero";
    const fecha = doc.fecha_documento || "";
    const fechaVenc = doc.fecha_vencimiento || "";

    let vigenciaText = "";
    if (fecha && fechaVenc) {
      const d1 = new Date(fecha);
      const d2 = new Date(fechaVenc);
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      vigenciaText = `${diffDays} dias`;
    }

    // Left side - proposal info
    drawText(`Propuesta # ${numCot.replace("COT-", "")}`, margin, y);
    y -= 14;
    drawText(`Fecha de cotizacion: ${fecha}`, margin, y);
    y -= 14;
    if (vigenciaText) {
      drawText(`Vigencia: ${vigenciaText}`, margin, y);
    }

    // Right side - company contact info
    const rightInfoStartY = y + 28;
    if (isLumaggs) {
      drawTextRight("chevron@lumaggs.com.mx", rightEdge, rightInfoStartY);
      drawTextRight("Procesadora de Servicios MAGG'S, SA de C.V.", rightEdge, rightInfoStartY - 14);
      drawTextRight("PSM 891005 QY7", rightEdge, rightInfoStartY - 28);
      drawTextRight("Tijuana | Mexicali | Ensenada", rightEdge, rightInfoStartY - 42);
      drawTextRight("San Quintin | Tecate", rightEdge, rightInfoStartY - 56);
      drawTextRight("+52 664 563 4361", rightEdge, rightInfoStartY - 70);
    } else {
      drawTextRight("lubricantes@dagal.com.mx", rightEdge, rightInfoStartY);
      drawTextRight("Proveedora Galsa SA de C.V.", rightEdge, rightInfoStartY - 14);
      drawTextRight("PGA850730EU0", rightEdge, rightInfoStartY - 28);
      drawTextRight("Tijuana | Mexicali | Ensenada", rightEdge, rightInfoStartY - 42);
      drawTextRight("San Quintin | Tecate", rightEdge, rightInfoStartY - 56);
      drawTextRight("+52 664 563 4361", rightEdge, rightInfoStartY - 70);
    }

    // Push "Dirigido a" block well below the right-side contact block
    // (right block ends at rightInfoStartY - 70 = y + 28 - 70 = y - 42)
    y -= 60;

    // ===== DIRIGIDO A =====
    const company = doc.companies as any;
    const contact = doc.contacts as any;
    const clientWhatsapp = contact?.whatsapp_phone || "";

    drawText("Dirigido a:", margin, y);
    y -= 14;
    // Use razon_social (legal name) for billing/PDF context, fallback to name
    const clientName = company?.razon_social || company?.name || "";
    drawText(clientName, margin, y, fontSize, fontBold);
    y -= 14;
    const contactName = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "";
    if (contactName) {
      drawText(contactName, margin, y);
      y -= 14;
    }
    if (clientWhatsapp) {
      drawText(`WhatsApp: ${clientWhatsapp}`, margin, y);
      y -= 14;
    }
    y -= 21; // extra space before table

    // ===== PRODUCTS TABLE =====
    addNewPageIfNeeded(60);

    // Codigo | Producto (wider) | Cantidad | Precio | Subtotal
    const col = {
      codigo: margin,
      producto: margin + 75,
      cantidad: margin + 340,
      precio: margin + 400,
      subtotal: margin + 465,
    };
    const subtotalColRight = rightEdge; // right edge of the Subtotal column

    // Table header - blue background
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: headerColor });
    drawText("Codigo", col.codigo + 5, y, 9, fontBold, rgb(1, 1, 1));
    drawText("Producto", col.producto + 5, y, 9, fontBold, rgb(1, 1, 1));
    drawText("Cantidad", col.cantidad + 5, y, 9, fontBold, rgb(1, 1, 1));
    drawText("Precio", col.precio + 5, y, 9, fontBold, rgb(1, 1, 1));
    drawText("Subtotal", col.subtotal + 5, y, 9, fontBold, rgb(1, 1, 1));
    y -= 24;

    // Table rows
    const productoMaxWidth = col.cantidad - col.producto - 10; // available width for product text
    (items || []).forEach((item: any) => {
      const prod = item.productos;
      const codigo = prod?.codigo || "";
      const nombre = prod?.nombre_producto || "";
      const presentacion = (prod?.presentaciones as any)?.nombre || "";
      const productoDesc = presentacion ? `${nombre} - ${presentacion}` : nombre;

      // Wrap product description
      const prodLines = wrapText(productoDesc, productoMaxWidth);
      const rowHeight = prodLines.length * 12 + 6; // 12pt per line + padding

      addNewPageIfNeeded(rowHeight);

      drawText(codigo, col.codigo + 5, y);
      // Draw wrapped product lines
      for (let li = 0; li < prodLines.length; li++) {
        drawText(prodLines[li], col.producto + 5, y - (li * 12));
      }
      drawText(String(item.cantidad), col.cantidad + 5, y);
      drawText(`$${fmtMoney(Number(item.precio_unitario))}`, col.precio + 5, y);
      drawTextRight(`$${fmtMoney(Number(item.subtotal))}`, subtotalColRight - 5, y);
      y -= rowHeight;
    });

    // ===== TOTALS (aligned with Subtotal column) =====
    y -= 20;
    addNewPageIfNeeded(60);

    const totLabelLeft = col.cantidad + 5;
    const totValueRight = subtotalColRight - 5;

    drawText("Subtotal:", totLabelLeft, y);
    drawTextRight(`$${fmtMoney(Number(doc.subtotal))}`, totValueRight, y);
    y -= 16;

    const ivaPct = Number(doc.iva_porcentaje) || 0;
    drawText(`IVA (${ivaPct}%):`, totLabelLeft, y);
    drawTextRight(`$${fmtMoney(Number(doc.iva_importe))}`, totValueRight, y);
    y -= 16;

    drawText("Total:", totLabelLeft, y, fontSize, fontBold);
    drawTextRight(`$${fmtMoney(Number(doc.total))}`, totValueRight, y, fontSize, fontBold);
    y -= 35;

    // ===== EJECUTIVO =====
    if (ejecutivoName) {
      addNewPageIfNeeded(50);
      drawLine(margin, y, rightEdge, 0.5, rgb(0.6, 0.6, 0.6));
      y -= 20;
      const ejLabel = "Ejecutivo: ";
      const ejLabelWidth = fontBold.widthOfTextAtSize(ejLabel, fontSize);
      drawText(ejLabel, margin, y, fontSize, fontBold);
      const ejDetailParts = [ejecutivoName, ejecutivoEmail, ejecutivoPhone].filter(Boolean);
      drawText(ejDetailParts.join(", "), margin + ejLabelWidth, y);
      y -= 20;
      drawLine(margin, y, rightEdge, 0.5, rgb(0.6, 0.6, 0.6));
      y -= 30;
    }

    // ===== CONDITIONS / NOTES =====
    addNewPageIfNeeded(40);
    drawText("Precios no incluyen IVA y estan sujetos a cambio sin previo aviso.", margin, y);
    y -= 24;

    if (condiciones?.contenido) {
      const lines = condiciones.contenido.split("\n");
      for (const line of lines) {
        addNewPageIfNeeded(14);
        const wrappedLines = wrapText(line, contentWidth);
        for (const wl of wrappedLines) {
          addNewPageIfNeeded(14);
          drawText(wl, margin, y);
          y -= 14;
        }
      }
    }

    // ===== NOTES =====
    if (doc.notas) {
      y -= 15;
      addNewPageIfNeeded(30);
      drawText("Notas:", margin, y, fontSize, fontBold);
      y -= 14;
      const notaLines = String(doc.notas).split(/\r?\n/).flatMap((l: string) => wrapText(l, contentWidth));
      for (const nl of notaLines) {
        addNewPageIfNeeded(14);
        drawText(nl, margin, y);
        y -= 14;
      }
    }

    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const fileName = `cotizaciones/${documento_id}.pdf`;
    const { error: uploadErr } = await sb.storage
      .from("document-files")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

    let pdfPublicUrl = "";
    if (!uploadErr) {
      const { data: urlData } = sb.storage.from("document-files").getPublicUrl(fileName);
      pdfPublicUrl = urlData?.publicUrl || "";
    }

    const updateData: any = {};
    if (pdfPublicUrl) updateData.pdf_url = pdfPublicUrl;
    if (doc.estatus_cotizacion === "borrador") updateData.estatus_cotizacion = "impresa";
    if (Object.keys(updateData).length > 0) {
      await sb.from("documentos").update(updateData).eq("id", documento_id);
    }

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Cotizacion_${doc.numero_cotizacion || doc.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    const knownMessages = new Set(["documento_id requerido", "Documento no encontrado"]);
    const msg = err instanceof Error && knownMessages.has(err.message)
      ? err.message
      : "Error interno al generar PDF";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});