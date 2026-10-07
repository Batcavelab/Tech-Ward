from django.urls import path

from . import views

app_name = "shop"

urlpatterns = [
    path("", views.home, name="home"),
    path("boutique/", views.product_list, name="list"),
    path("boutique/<slug:cat>/", views.product_list, name="list"),
    path("produit/<slug:slug>/", views.product_detail, name="product"),
    path("packs/", views.packs, name="packs"),
    path("alarme-acces/", views.security, name="security"),
    path("contact/", views.contact, name="contact"),
    path("panier/", views.cart, name="cart"),
]
