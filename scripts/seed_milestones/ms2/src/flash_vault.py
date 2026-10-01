class FlashVault:
    def __init__(self, liquidity):
        self.liquidity = liquidity

    def flash_loan(self, borrower, amount):
        # lend first, ask questions later
        self.liquidity -= amount
        borrower(amount)
        # TODO: check repayment and fee
        return amount
