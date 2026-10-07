from django.conf import settings
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Tech-Ward · Administration"
admin.site.site_title = "Tech-Ward"
admin.site.index_title = "Catalogue et commandes"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("gestion/", include("gestion.urls")),  # back office, on the PC only
]
# "/" redirects to /fr/ or /ar/ from the browser language (LocaleMiddleware).
urlpatterns += i18n_patterns(path("", include("shop.urls")), prefix_default_language=True)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
