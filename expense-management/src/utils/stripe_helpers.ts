import { format, addDays } from "date-fns";
import Stripe from "stripe";

import StripeAccount from "./stripe-account";
import { getStripeSecretKey } from "./stripe-authentication";

import { BalanceChartData } from "src/types/chart-data";
import stripeClient from "src/utils/stripe-loader";

type FundsFlowByDate = {
  date: string;
  fundsIn: number;
  fundsOut: number;
};

const NUMBER_OF_DAYS = 10;
const DATE_FORMAT = "MMM dd";

export async function getCardholders(stripeAccount: StripeAccount) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);
  const cardholders = await stripe.issuing.cardholders.list(
    { limit: 100 },
    { stripeAccount: accountId },
  );

  return {
    cardholders: cardholders,
  };
}

export async function getCards(stripeAccount: StripeAccount) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);
  const cards = await stripe.issuing.cards.list(
    { limit: 100 },
    { stripeAccount: accountId },
  );

  return {
    cards: cards,
  };
}

export async function getCardDetails(
  stripeAccount: StripeAccount,
  cardId: string,
) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);
  // Retrieve last 10 authorizations
  const card_authorizations = await stripe.issuing.authorizations.list(
    {
      card: cardId,
      limit: 10,
    },
    { stripeAccount: accountId },
  );

  // Calculate current spend
  let current_spend = 0;
  card_authorizations.data.forEach(function (
    authorization: Stripe.Issuing.Authorization,
  ) {
    // Validate the authorization was approved before adding it to the total spend
    if (authorization.approved == true) {
      current_spend = current_spend + authorization.amount;
    }
  });

  const card_details = await stripe.issuing.cards.retrieve(
    cardId,
    { expand: ["cardholder"] },
    {
      stripeAccount: accountId,
    },
  );

  const cardTransactions = {
    card_authorizations: [] as Stripe.Issuing.Authorization[],
    current_spend: 0,
    card_details: {} as Stripe.Issuing.Card,
  };
  cardTransactions["card_authorizations"] = card_authorizations.data;
  cardTransactions["current_spend"] = current_spend;
  cardTransactions["card_details"] = card_details;

  return cardTransactions;
}

export async function getAuthorizations(stripeAccount: StripeAccount) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);
  const authorizations = await stripe.issuing.authorizations.list(
    { limit: 10 },
    { stripeAccount: accountId },
  );

  return {
    authorizations,
  };
}

export async function getAuthorizationDetails(
  stripeAccount: StripeAccount,
  authorizationId: string,
) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);
  const authorization = await stripe.issuing.authorizations.retrieve(
    authorizationId,
    { stripeAccount: accountId },
  );

  return {
    authorization,
  };
}

export async function getBalance(stripeAccount: StripeAccount) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);

  const balance = await stripe.balance.retrieve({
    stripeAccount: accountId,
  });

  return {
    balance: balance,
  };
}

export async function getBalanceTransactions(
  stripeAccount: StripeAccount,
  currency: string,
) {
  const { accountId, platform } = stripeAccount;
  const stripe = stripeClient(platform);

  // Calculate the start and end date for the last 7 days
  const endDate = new Date();
  const startDate = addDays(endDate, -NUMBER_OF_DAYS + 1);

  const balanceTransactions = await stripe.balanceTransactions.list(
    {
      created: {
        gte: Math.floor(startDate.getTime() / 1000), // Convert to seconds
        lte: Math.floor(endDate.getTime() / 1000), // Convert to seconds
      },
      limit: 100,
    },
    { stripeAccount: accountId },
  );

  const datesArray: string[] = Array.from(
    { length: NUMBER_OF_DAYS },
    (_, index) => {
      const date = addDays(endDate, -index);
      return format(date, DATE_FORMAT);
    },
  );

  const fundsFlowByDate: { [formattedDate: string]: FundsFlowByDate } =
    datesArray.reduce(
      (dates, formattedDate) => {
        dates[formattedDate] = {
          date: formattedDate,
          fundsIn: 0,
          fundsOut: 0,
        };
        return dates;
      },
      {} as { [formattedDate: string]: FundsFlowByDate },
    );

  const transactionList: Stripe.BalanceTransaction[] = [];

  balanceTransactions.data.forEach(function (
    transaction: Stripe.BalanceTransaction,
  ) {
    const date = new Date(transaction.created * 1000);
    const formattedDate = format(date, DATE_FORMAT);
    const amount = Math.abs(transaction.amount) / 100;
    const type = transaction.type;

    if (
      !(
        type == "issuing_authorization_release" ||
        type == "issuing_authorization_hold"
      )
    ) {
      if (fundsFlowByDate.hasOwnProperty(formattedDate)) {
        if (transaction.amount > 0) {
          fundsFlowByDate[formattedDate].fundsIn += amount;
        } else {
          fundsFlowByDate[formattedDate].fundsOut += amount;
        }
      }

      transactionList.push(transaction);
    }
  });

  const fundsInArray: number[] = datesArray.map(
    (formattedDate) => fundsFlowByDate[formattedDate].fundsIn,
  );
  const fundsOutArray: number[] = datesArray.map(
    (formattedDate) => fundsFlowByDate[formattedDate].fundsOut,
  );

  // Reverse the arrays
  datesArray.reverse();
  fundsInArray.reverse();
  fundsOutArray.reverse();

  const balanceTransactionsChart: BalanceChartData = {
    currency: currency,
    balanceTransactionsDates: datesArray,
    balanceTransactionsFundsIn: fundsInArray,
    balanceTransactionsFundsOut: fundsOutArray,
  };

  return {
    balanceTransactions: transactionList,
    balanceFundsFlowChartData: balanceTransactionsChart,
  };
}

export type FinancialAddress = {
  type: "iban" | "sort_code" | "aba";
  supported_networks: string[];
  iban?: {
    account_holder_name: string;
    bic: string;
    country: string;
    iban: string;
  };
  sort_code?: {
    account_holder_name: string;
    account_number: string;
    sort_code: string;
  };
  aba?: {
    account_number: string;
    bank_name: string;
    routing_number: string;
  };
};

export type FundingInstructions = {
  currency: string;
  funding_type: string;
  livemode: boolean;
  object: string;
  bank_transfer: {
    country: string;
    type: string;
    financial_addresses: FinancialAddress[];
  };
};

const getBankTransferType = (country: string): string => {
  switch (country) {
    case "GB":
      return "gb_bank_transfer";
    case "US":
      return "us_bank_transfer";
    default:
      return "eu_bank_transfer";
  }
};

export async function createFundingInstructions(
  stripeAccount: StripeAccount,
  country: string,
  currency: string,
): Promise<FundingInstructions> {
  const { accountId, platform } = stripeAccount;
  const bankTransferType = getBankTransferType(country);
  const data = {
    currency: currency as string,
    funding_type: "bank_transfer",
    "bank_transfer[type]": bankTransferType,
  };

  // using fetch, because this API is not yet supported in the Node.js libary
  const response = await fetch(
    "https://api.stripe.com/v1/issuing/funding_instructions",
    {
      method: "POST",
      headers: {
        "Stripe-Account": accountId,
        "content-type": "application/x-www-form-urlencoded",
        Authorization: "Bearer " + getStripeSecretKey(platform),
      },
      body: new URLSearchParams(data),
    },
  );
  const responseBody = await response.json();
  return responseBody;
}
