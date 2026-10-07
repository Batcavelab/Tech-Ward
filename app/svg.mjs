// SVG drawings and icons, converted from the original templates.
import { esc, raw } from "./html.mjs";

// Placeholder drawing until a real photo is uploaded.
export function artSvg(art, uid, label) {
  let o = "";
  o += "\n<svg class=\"art\" viewBox=\"0 0 400 300\" role=\"img\" aria-label=\"";
  o += esc(label);
  o += "\" xmlns=\"http://www.w3.org/2000/svg\">\n  <defs>\n    <linearGradient id=\"bg-";
  o += esc(uid);
  o += "\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n      ";
  if (art === "bullet" || art === "ptz" || art === "doorbell" || art === "siren") {
    o += "<stop offset=\"0\" stop-color=\"#cfe1f6\"/><stop offset=\"1\" stop-color=\"#f3f7fc\"/>";
  } else {
    o += "<stop offset=\"0\" stop-color=\"#f6f8fb\"/><stop offset=\"1\" stop-color=\"#e6edf6\"/>";
  }
  o += "\n    </linearGradient>\n    <linearGradient id=\"body-";
  o += esc(uid);
  o += "\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\"1\" stop-color=\"#dfe5ee\"/></linearGradient>\n    <radialGradient id=\"lens-";
  o += esc(uid);
  o += "\" cx=\".4\" cy=\".35\" r=\".7\"><stop offset=\"0\" stop-color=\"#3a4a63\"/><stop offset=\".55\" stop-color=\"#121c2c\"/><stop offset=\"1\" stop-color=\"#05090f\"/></radialGradient>\n  </defs>\n  <rect width=\"400\" height=\"300\" fill=\"url(#bg-";
  o += esc(uid);
  o += ")\"/>\n  ";
  if (art === "bullet" || art === "ptz" || art === "doorbell" || art === "siren") {
    o += "\n    <rect x=\"330\" y=\"0\" width=\"70\" height=\"300\" fill=\"#c9ced6\"/><rect x=\"330\" y=\"0\" width=\"8\" height=\"300\" fill=\"#b3b9c3\"/>\n    <path d=\"M0 250c40-30 70-10 95-30s50-5 70 0v80H0z\" fill=\"#9db7a0\" opacity=\".55\"/>\n  ";
  }
  o += "\n  <ellipse cx=\"200\" cy=\"268\" rx=\"120\" ry=\"10\" fill=\"#0f1b2d\" opacity=\".08\"/>\n\n  ";
  if (art === "indoor") {
    o += "\n    <path d=\"M168 205h64l14 52h-92z\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n    <ellipse cx=\"200\" cy=\"258\" rx=\"58\" ry=\"10\" fill=\"#e9eef5\" stroke=\"#cfd6e1\"/>\n    <rect x=\"128\" y=\"62\" width=\"144\" height=\"150\" rx=\"46\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#d3dae4\"/>\n    <circle cx=\"200\" cy=\"132\" r=\"46\" fill=\"#0f1b2d\"/><circle cx=\"200\" cy=\"132\" r=\"32\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/>\n    <circle cx=\"200\" cy=\"132\" r=\"15\" fill=\"#1d74d8\" opacity=\".85\"/><circle cx=\"192\" cy=\"123\" r=\"6\" fill=\"#fff\" opacity=\".7\"/>\n    <circle cx=\"200\" cy=\"190\" r=\"3\" fill=\"#1d74d8\"/>\n  ";
  } else if (art === "bullet") {
    o += "\n    <rect x=\"318\" y=\"98\" width=\"22\" height=\"80\" rx=\"6\" fill=\"#f3f5f8\" stroke=\"#cfd6e1\"/>\n    <path d=\"M318 130h-38l-12 14h50z\" fill=\"#e9edf3\" stroke=\"#cfd6e1\"/>\n    <g transform=\"rotate(-10 200 150)\">\n      <rect x=\"70\" y=\"105\" width=\"210\" height=\"84\" rx=\"38\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n      <path d=\"M58 100h200c10 0 14 6 14 12v4H58c-8 0-8-16 0-16z\" fill=\"#fbfcfd\" stroke=\"#cfd6e1\"/>\n      <ellipse cx=\"88\" cy=\"147\" rx=\"24\" ry=\"40\" fill=\"#111a29\"/>\n      <circle cx=\"90\" cy=\"147\" r=\"24\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><circle cx=\"90\" cy=\"147\" r=\"11\" fill=\"#1d74d8\" opacity=\".8\"/><circle cx=\"84\" cy=\"140\" r=\"5\" fill=\"#fff\" opacity=\".7\"/>\n      <text x=\"150\" y=\"152\" font-family=\"Inter,Arial\" font-size=\"13\" font-weight=\"700\" fill=\"#0f1b2d\">TECH-WARD</text>\n    </g>\n  ";
  } else if (art === "ptz") {
    o += "\n    <path d=\"M330 80h-120v24h106\" fill=\"#f4f6f9\" stroke=\"#cfd6e1\"/>\n    <rect x=\"186\" y=\"80\" width=\"34\" height=\"58\" fill=\"#eef1f6\" stroke=\"#cfd6e1\"/>\n    <path d=\"M136 138h134v32c0 6-5 10-10 10H146c-5 0-10-4-10-10z\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n    <path d=\"M140 178h126c0 50-28 80-63 80s-63-30-63-80z\" fill=\"#111a29\"/>\n    <path d=\"M150 182h106c0 40-23 64-53 64s-53-24-53-64z\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/>\n    <circle cx=\"203\" cy=\"214\" r=\"16\" fill=\"#1d74d8\" opacity=\".85\"/><circle cx=\"197\" cy=\"208\" r=\"6\" fill=\"#fff\" opacity=\".6\"/>\n  ";
  } else if (art === "doorbell") {
    o += "\n    <rect x=\"160\" y=\"40\" width=\"80\" height=\"220\" rx=\"34\" fill=\"#18202c\"/>\n    <rect x=\"167\" y=\"47\" width=\"66\" height=\"206\" rx=\"28\" fill=\"#232d3c\"/>\n    <circle cx=\"200\" cy=\"96\" r=\"20\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><circle cx=\"200\" cy=\"96\" r=\"8\" fill=\"#1d74d8\"/>\n    <circle cx=\"200\" cy=\"200\" r=\"20\" fill=\"none\" stroke=\"#3fa0ff\" stroke-width=\"5\"/><circle cx=\"200\" cy=\"200\" r=\"12\" fill=\"#2a3546\"/>\n  ";
  } else if (art === "nvr" || art === "hdd") {
    o += "\n    ";
    if (art === "nvr") {
      o += "\n      <path d=\"M70 150 200 110l130 40-130 40z\" fill=\"#2a3546\"/>\n      <path d=\"M70 150v40l130 40v-40z\" fill=\"#18202c\"/><path d=\"M330 150v40l-130 40v-40z\" fill=\"#222c3a\"/>\n      <circle cx=\"96\" cy=\"182\" r=\"3\" fill=\"#36d27a\"/><circle cx=\"108\" cy=\"186\" r=\"3\" fill=\"#1d74d8\"/><circle cx=\"120\" cy=\"190\" r=\"3\" fill=\"#1d74d8\"/>\n      <text x=\"135\" y=\"209\" font-family=\"Inter,Arial\" font-size=\"11\" font-weight=\"700\" fill=\"#9fb3cf\" transform=\"rotate(17 135 209)\">NVR</text>\n    ";
    } else {
      o += "\n      <rect x=\"120\" y=\"70\" width=\"160\" height=\"190\" rx=\"12\" fill=\"#c4cad3\" stroke=\"#a9b1bd\"/>\n      <rect x=\"132\" y=\"82\" width=\"136\" height=\"110\" rx=\"6\" fill=\"#18202c\"/>\n      <text x=\"146\" y=\"128\" font-family=\"Inter,Arial\" font-size=\"20\" font-weight=\"800\" fill=\"#fff\">2 TB</text>\n      <text x=\"146\" y=\"152\" font-family=\"Inter,Arial\" font-size=\"11\" fill=\"#7fb4ff\">SURVEILLANCE</text>\n      <rect x=\"146\" y=\"214\" width=\"108\" height=\"10\" rx=\"3\" fill=\"#9aa3b0\"/>\n    ";
    }
    o += "\n  ";
  } else if (art === "alarm" || art === "keypad" || art === "finger") {
    o += "\n    <rect x=\"135\" y=\"40\" width=\"130\" height=\"220\" rx=\"16\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n    ";
    if (art === "finger") {
      o += "\n      <rect x=\"152\" y=\"58\" width=\"96\" height=\"70\" rx=\"6\" fill=\"#18202c\"/><rect x=\"160\" y=\"66\" width=\"80\" height=\"54\" rx=\"3\" fill=\"#1d74d8\" opacity=\".55\"/>\n      <rect x=\"168\" y=\"150\" width=\"64\" height=\"80\" rx=\"30\" fill=\"#18202c\"/>\n      <g fill=\"none\" stroke=\"#3fa0ff\" stroke-width=\"2.5\" stroke-linecap=\"round\"><path d=\"M186 205c0-18 4-30 14-30s14 12 14 30\"/><path d=\"M193 210c0-15 2-25 7-25s7 10 7 25\"/><path d=\"M178 196c2-20 10-32 22-32s20 12 22 32\"/></g>\n    ";
    } else {
      o += "\n      <rect x=\"152\" y=\"58\" width=\"96\" height=\"44\" rx=\"6\" fill=\"#18202c\"/>\n      <text x=\"162\" y=\"86\" font-family=\"Inter,Arial\" font-size=\"15\" font-weight=\"700\" fill=\"";
      if (art === 'alarm') {
        o += "#36d27a";
      } else {
        o += "#7fb4ff";
      }
      o += "\">";
      if (art === "alarm") {
        o += "ARMED";
      } else {
        o += "• • • •";
      }
      o += "</text>\n      <g fill=\"#e8edf4\" stroke=\"#cfd6e1\"><rect x=\"156\" y=\"118\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"188\" y=\"118\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"220\" y=\"118\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"156\" y=\"146\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"188\" y=\"146\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"220\" y=\"146\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"156\" y=\"174\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"188\" y=\"174\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"220\" y=\"174\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"156\" y=\"202\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"188\" y=\"202\" width=\"24\" height=\"20\" rx=\"4\"/><rect x=\"220\" y=\"202\" width=\"24\" height=\"20\" rx=\"4\"/></g>\n      <circle cx=\"200\" cy=\"244\" r=\"5\" fill=\"#1d74d8\"/>\n    ";
    }
    o += "\n  ";
  } else if (art === "sensor") {
    o += "\n    <rect x=\"150\" y=\"70\" width=\"100\" height=\"160\" rx=\"22\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n    <ellipse cx=\"200\" cy=\"140\" rx=\"34\" ry=\"40\" fill=\"#e3e8ef\" stroke=\"#cfd6e1\"/>\n    <path d=\"M170 128h60M168 140h64M170 152h60\" stroke=\"#ccd3de\" stroke-width=\"2\"/>\n    <circle cx=\"200\" cy=\"205\" r=\"4\" fill=\"#e04848\"/>\n  ";
  } else if (art === "siren") {
    o += "\n    <rect x=\"135\" y=\"85\" width=\"130\" height=\"150\" rx=\"18\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n    <path d=\"M150 85h100l-10-30h-80z\" fill=\"#ff7a3d\" opacity=\".9\"/>\n    <path d=\"M200 35v-14M160 42l-8-10M240 42l8-10\" stroke=\"#ff7a3d\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n    <g fill=\"#d5dbe4\"><rect x=\"160\" y=\"120\" width=\"80\" height=\"6\" rx=\"3\"/><rect x=\"160\" y=\"138\" width=\"80\" height=\"6\" rx=\"3\"/><rect x=\"160\" y=\"156\" width=\"80\" height=\"6\" rx=\"3\"/><rect x=\"160\" y=\"174\" width=\"80\" height=\"6\" rx=\"3\"/><rect x=\"160\" y=\"192\" width=\"80\" height=\"6\" rx=\"3\"/><rect x=\"160\" y=\"210\" width=\"80\" height=\"6\" rx=\"3\"/></g>\n  ";
  } else if (art === "intercom") {
    o += "\n    <rect x=\"70\" y=\"70\" width=\"190\" height=\"140\" rx=\"12\" fill=\"#18202c\"/>\n    <rect x=\"80\" y=\"80\" width=\"140\" height=\"120\" rx=\"4\" fill=\"#2c4d7a\"/>\n    <circle cx=\"150\" cy=\"128\" r=\"22\" fill=\"#9cc0ea\"/><path d=\"M110 200c4-28 22-42 40-42s36 14 40 42z\" fill=\"#9cc0ea\"/>\n    <circle cx=\"240\" cy=\"110\" r=\"8\" fill=\"#36d27a\"/><circle cx=\"240\" cy=\"140\" r=\"8\" fill=\"#3fa0ff\"/>\n    <rect x=\"285\" y=\"90\" width=\"60\" height=\"150\" rx=\"10\" fill=\"#c4cad3\" stroke=\"#a9b1bd\"/>\n    <circle cx=\"315\" cy=\"120\" r=\"12\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><rect x=\"300\" y=\"180\" width=\"30\" height=\"30\" rx=\"6\" fill=\"#e8edf4\"/>\n  ";
  } else if (art === "lock") {
    o += "\n    <rect x=\"120\" y=\"30\" width=\"160\" height=\"250\" fill=\"#b48b5e\"/><rect x=\"128\" y=\"38\" width=\"144\" height=\"242\" fill=\"#c49a6c\"/>\n    <rect x=\"215\" y=\"70\" width=\"50\" height=\"170\" rx=\"12\" fill=\"#18202c\"/>\n    <rect x=\"223\" y=\"82\" width=\"34\" height=\"60\" rx=\"4\" fill=\"#253248\"/>\n    <g fill=\"#3fa0ff\"><circle cx=\"230\" cy=\"96\" r=\"2.5\"/><circle cx=\"240\" cy=\"96\" r=\"2.5\"/><circle cx=\"250\" cy=\"96\" r=\"2.5\"/><circle cx=\"230\" cy=\"110\" r=\"2.5\"/><circle cx=\"240\" cy=\"110\" r=\"2.5\"/><circle cx=\"250\" cy=\"110\" r=\"2.5\"/><circle cx=\"230\" cy=\"124\" r=\"2.5\"/><circle cx=\"240\" cy=\"124\" r=\"2.5\"/><circle cx=\"250\" cy=\"124\" r=\"2.5\"/></g>\n    <rect x=\"160\" y=\"150\" width=\"70\" height=\"16\" rx=\"8\" fill=\"#2a3546\"/>\n    <circle cx=\"240\" cy=\"200\" r=\"12\" fill=\"#253248\" stroke=\"#3fa0ff\" stroke-width=\"2\"/>\n  ";
  } else if (art === "cable") {
    o += "\n    <circle cx=\"200\" cy=\"150\" r=\"90\" fill=\"#1d74d8\"/><circle cx=\"200\" cy=\"150\" r=\"78\" fill=\"none\" stroke=\"#3a8ae6\" stroke-width=\"6\"/>\n    <circle cx=\"200\" cy=\"150\" r=\"62\" fill=\"none\" stroke=\"#3a8ae6\" stroke-width=\"6\"/><circle cx=\"200\" cy=\"150\" r=\"38\" fill=\"#eef3fa\"/>\n    <path d=\"M280 180c40 10 60 40 50 70\" stroke=\"#1d74d8\" stroke-width=\"8\" fill=\"none\" stroke-linecap=\"round\"/>\n    <rect x=\"316\" y=\"240\" width=\"28\" height=\"22\" rx=\"4\" fill=\"#dfe5ee\" stroke=\"#a9b1bd\"/>\n  ";
  } else if (art === "pack") {
    o += "\n    <path d=\"M90 200 200 170l110 30-110 30z\" fill=\"#2a3546\"/><path d=\"M90 200v26l110 30v-26z\" fill=\"#18202c\"/><path d=\"M310 200v26l-110 30v-26z\" fill=\"#222c3a\"/>\n    <g transform=\"translate(40 70) rotate(-8 60 40)\">\n      <rect x=\"20\" y=\"20\" width=\"100\" height=\"44\" rx=\"20\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n      <circle cx=\"34\" cy=\"42\" r=\"14\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><circle cx=\"34\" cy=\"42\" r=\"6\" fill=\"#1d74d8\"/>\n    </g>\n    <g transform=\"translate(140 40) rotate(-8 60 40)\">\n      <rect x=\"20\" y=\"20\" width=\"100\" height=\"44\" rx=\"20\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n      <circle cx=\"34\" cy=\"42\" r=\"14\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><circle cx=\"34\" cy=\"42\" r=\"6\" fill=\"#1d74d8\"/>\n    </g>\n    <g transform=\"translate(240 70) rotate(-8 60 40)\">\n      <rect x=\"20\" y=\"20\" width=\"100\" height=\"44\" rx=\"20\" fill=\"url(#body-";
    o += esc(uid);
    o += ")\" stroke=\"#cfd6e1\"/>\n      <circle cx=\"34\" cy=\"42\" r=\"14\" fill=\"url(#lens-";
    o += esc(uid);
    o += ")\"/><circle cx=\"34\" cy=\"42\" r=\"6\" fill=\"#1d74d8\"/>\n    </g>\n  ";
  } else {
    o += "\n    <circle cx=\"200\" cy=\"145\" r=\"80\" fill=\"#e3ecf8\"/>\n    <path d=\"M200 80 145 102v40c0 34 24 62 55 70 31-8 55-36 55-70v-40z\" fill=\"#16243a\"/>\n    <path d=\"M200 80v132c31-8 55-36 55-70v-40z\" fill=\"#1d74d8\"/>\n    <path d=\"m176 146 16 16 32-34\" stroke=\"#fff\" stroke-width=\"9\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  ";
  }
  o += "\n</svg>\n";
  return raw(o);
}

export function icon(name) {
  let o = "";
  if (name === "whatsapp") {
    o += "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.7A11.8 11.8 0 0 0 24 12c0-3.2-1.2-6.1-3.6-8.4z\"/></svg>";
  } else {
    o += "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">";
    if (name === "search") {
      o += "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>";
    } else if (name === "cart") {
      o += "<circle cx=\"9\" cy=\"20\" r=\"1.4\"/><circle cx=\"18\" cy=\"20\" r=\"1.4\"/><path d=\"M2.5 3h2.6l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h8.6a1.8 1.8 0 0 0 1.7-1.3L21.5 7H6\"/>";
    } else if (name === "menu") {
      o += "<path d=\"M4 6h16M4 12h16M4 18h16\"/>";
    } else if (name === "arrow") {
      o += "<path d=\"M5 12h14M13 6l6 6-6 6\"/>";
    } else if (name === "check") {
      o += "<path d=\"m5 12.5 4.5 4.5L19 7.5\"/>";
    } else if (name === "clock") {
      o += "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>";
    } else if (name === "phone") {
      o += "<rect x=\"6.5\" y=\"2.5\" width=\"11\" height=\"19\" rx=\"2.5\"/><path d=\"M11 18.5h2\"/>";
    } else if (name === "moon") {
      o += "<path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z\"/><path d=\"M17 3.5v3M15.5 5h3\"/>";
    } else if (name === "wrench") {
      o += "<path d=\"M14.7 6.3a4 4 0 0 0 5 5L21 10a6 6 0 0 1-7.6 6.2L7 22.6a2 2 0 0 1-2.8-2.8l6.4-6.4A6 6 0 0 1 16.8 5.8z\"/>";
    } else if (name === "shield") {
      o += "<path d=\"M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z\"/><path d=\"m9 12 2 2 4-4\"/>";
    } else if (name === "mail") {
      o += "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3.5 6.5 8.5 6 8.5-6\"/>";
    } else if (name === "pin") {
      o += "<path d=\"M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/>";
    } else if (name === "trash") {
      o += "<path d=\"M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3\"/>";
    } else if (name === "spec") {
      o += "<circle cx=\"12\" cy=\"12\" r=\"3\"/><circle cx=\"12\" cy=\"12\" r=\"8.5\"/>";
    }
    o += "</svg>";
  }
  return raw(o);
}

// Gestion icons.
export function gicon(i) {
  let o = "";
  o += "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">";
  if (i === "home") {
    o += "<path d=\"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z\"/>";
  } else if (i === "doc") {
    o += "<path d=\"M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z\"/><path d=\"M14 3v5h5M8 13h8M8 17h5\"/>";
  } else if (i === "users") {
    o += "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.5 3.5 5.2\"/>";
  } else if (i === "box") {
    o += "<path d=\"M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8\"/>";
  } else if (i === "layers") {
    o += "<path d=\"M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5\" />";
  } else if (i === "tag") {
    o += "<path d=\"M20 12l-8 8-9-9V3h8z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.5\"/>";
  } else if (i === "cart") {
    o += "<path d=\"M3 4h2l2.4 11h11l2-8H6.2\"/><circle cx=\"9\" cy=\"19.5\" r=\"1.5\"/><circle cx=\"17\" cy=\"19.5\" r=\"1.5\"/>";
  } else if (i === "truck") {
    o += "<path d=\"M2 6h12v10H2zM14 10h4l3 3v3h-7\"/><circle cx=\"6\" cy=\"18\" r=\"2\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/>";
  } else if (i === "warehouse") {
    o += "<path d=\"M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10\"/>";
  } else if (i === "chart") {
    o += "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>";
  } else if (i === "upload") {
    o += "<path d=\"M12 16V4M7 9l5-5 5 5M4 20h16\"/>";
  } else if (i === "plus") {
    o += "<path d=\"M12 5v14M5 12h14\"/>";
  } else if (i === "pdf") {
    o += "<path d=\"M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z\"/><path d=\"M14 3v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5\"/>";
  } else if (i === "wa") {
    o += "<path d=\"M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z\"/><path d=\"M9 9c0 3 3 6 6 6l1.2-1.4-2-1-1 .8c-1-.5-2.1-1.6-2.6-2.6l.8-1-1-2z\"/>";
  } else if (i === "mail") {
    o += "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"1.5\"/><path d=\"M3.5 6l8.5 7 8.5-7\"/>";
  } else if (i === "trophy") {
    o += "<path d=\"M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9 17h6v4H9z\"/>";
  } else if (i === "edit") {
    o += "<path d=\"M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4\"/>";
  } else if (i === "copy") {
    o += "<rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"1.5\"/><path d=\"M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3\"/>";
  }
  o += "</svg>";
  return raw(o);
}
