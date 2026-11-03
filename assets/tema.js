/* Aplica el tema guardado antes del primer pintado. / Applies the stored theme before first paint. */
try {
  var tema = localStorage.getItem("cv:tema");
  if (tema === "claro" || tema === "oscuro") {
    document.documentElement.setAttribute("data-tema", tema);
  }
} catch (e) {
  /* sin almacenamiento / no storage */
}
