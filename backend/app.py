from fastapi import FastAPI
from controller.CategoryController import router as category_router
from controller.CategorySortingController import router as category_sorting_router
from controller.StockItemController import router as stock_item_router
from controller.StockItemSortingController import router as stock_item_sorting_router
from controller.BillController import router as bill_router
from controller.DepositReturnController import router as deposit_return_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.include_router(category_router)
app.include_router(category_sorting_router)
app.include_router(stock_item_router)
app.include_router(stock_item_sorting_router)
app.include_router(bill_router)
app.include_router(deposit_return_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # oder ["*"] für offen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)