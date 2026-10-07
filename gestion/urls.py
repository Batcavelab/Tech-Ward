from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

app_name = "gestion"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("connexion/", auth_views.LoginView.as_view(template_name="gestion/login.html"), name="login"),
    path("deconnexion/", auth_views.LogoutView.as_view(next_page="gestion:login"), name="logout"),

    path("catalogue/", views.products, name="products"),
    path("catalogue/nouveau/", views.product_edit, name="product_new"),
    path("catalogue/<int:pk>/", views.product_edit, name="product"),
    path("catalogue/<int:pk>/supprimer/", views.product_delete, name="product_delete"),
    path("packs/", views.packs, name="packs"),
    path("packs/nouveau/", views.pack_edit, name="pack_new"),
    path("packs/<int:pk>/", views.pack_edit, name="pack"),
    path("offres/", views.offers, name="offers"),
    path("offres/nouvelle/", views.offer_edit, name="offer_new"),
    path("offres/<int:pk>/", views.offer_edit, name="offer"),
    path("offres/<int:pk>/supprimer/", views.offer_delete, name="offer_delete"),

    path("clients/", views.customers, name="customers"),
    path("clients/nouveau/", views.customer_edit, name="customer_new"),
    path("clients/<int:pk>/", views.customer_edit, name="customer"),
    path("fournisseurs/", views.suppliers, name="suppliers"),
    path("fournisseurs/nouveau/", views.supplier_edit, name="supplier_new"),
    path("fournisseurs/<int:pk>/", views.supplier_edit, name="supplier"),

    path("devis/", views.quotes, name="quotes"),
    path("devis/nouveau/", views.quote_edit, name="quote_new"),
    path("devis/<int:pk>/", views.quote_detail, name="quote"),
    path("devis/<int:pk>/modifier/", views.quote_edit, name="quote_edit"),
    path("devis/<int:pk>/pdf/", views.quote_pdf, name="quote_pdf"),
    path("devis/<int:pk>/statut/", views.quote_status, name="quote_status"),
    path("devis/<int:pk>/whatsapp/", views.quote_sent, name="quote_sent"),
    path("devis/<int:pk>/email/", views.quote_email, name="quote_email"),
    path("devis/<int:pk>/dupliquer/", views.quote_duplicate, name="quote_duplicate"),

    path("achats/", views.orders, name="orders"),
    path("achats/nouveau/", views.order_edit, name="order_new"),
    path("achats/<int:pk>/", views.order_detail, name="order"),
    path("achats/<int:pk>/modifier/", views.order_edit, name="order_edit"),
    path("achats/<int:pk>/pdf/", views.order_pdf, name="order_pdf"),
    path("achats/<int:pk>/statut/", views.order_status, name="order_status"),
    path("achats/<int:pk>/email/", views.order_email, name="order_email"),

    path("stock/", views.stock, name="stock"),
    path("finances/", views.finances, name="finances"),
    path("finances/depense/<int:pk>/", views.expense_edit, name="expense"),
    path("publier/", views.publish, name="publish"),
    path("publier/site.zip", views.publish_zip, name="publish_zip"),
    path("site-web/", views.site_settings, name="site"),
]
